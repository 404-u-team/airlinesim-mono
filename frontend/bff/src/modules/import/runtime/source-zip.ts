import { inflateRawSync } from "node:zlib";

import type { ImportLogger } from "./logger";

import { fetchSource, loadCachedSource } from "./source-fetch";

export async function loadCachedZip<T>(
  path: string,
  url: string,
  entryName: RegExp | string,
  refreshRaw: boolean,
  parse: (text: string) => T,
  log?: ImportLogger,
): Promise<T> {
  return loadCachedSource(path, refreshRaw, parse, async () => {
    const archive = await fetchSource(url, path, async (response) => response.arrayBuffer(), log);
    return extractZipText(archive, entryName);
  }, log);
}

function extractZipText(archive: ArrayBuffer, entryName: RegExp | string): string {
  const view = new DataView(archive);
  const decoder = new TextDecoder();
  const { entries, start } = findCentralDirectory(view);
  let offset = start;

  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP central directory entry");
    }

    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const name = decoder.decode(new Uint8Array(archive, offset + 46, nameLength));
    if (typeof entryName === "string" ? name === entryName : entryName.test(name)) {
      return decoder.decode(extractZipEntry(view, offset));
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`Could not find ${String(entryName)} in ZIP file`);
}

function extractZipEntry(view: DataView, offset: number): Uint8Array {
  const method = view.getUint16(offset + 10, true);
  const compressedSize = view.getUint32(offset + 20, true);
  const localHeader = view.getUint32(offset + 42, true);
  if (view.getUint32(localHeader, true) !== 0x04034b50) {
    throw new Error("Invalid ZIP local header");
  }

  const start = localHeader + 30 + view.getUint16(localHeader + 26, true) + view.getUint16(localHeader + 28, true);
  const content = new Uint8Array(view.buffer, start, compressedSize);
  if (method === 0) {
    return content;
  }
  if (method === 8) {
    return inflateRawSync(content);
  }
  throw new Error(`Unsupported ZIP compression method ${String(method)}`);
}

function findCentralDirectory(view: DataView): { entries: number; start: number } {
  const first = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= first; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === view.byteLength) {
      return { entries: view.getUint16(offset + 10, true), start: view.getUint32(offset + 16, true) };
    }
  }

  throw new Error("Could not find ZIP central directory");
}
