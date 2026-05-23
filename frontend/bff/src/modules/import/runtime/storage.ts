import type { ImportMapping, ImportReport } from "../shared/types";

import { mkdir } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const DEFAULT_DATA_DIR = "data/import/world-data";

export type ImportPaths = {
  dataDir: string;
  manualDir: string;
  mappingPath: string;
  rawDir: string;
  reportsDir: string;
  stageDir: string;
};

export function getImportPaths(dataDir = DEFAULT_DATA_DIR): ImportPaths {
  return {
    dataDir,
    manualDir: `${dataDir}/manual`,
    mappingPath: `${dataDir}/mappings/source-mapping.json`,
    rawDir: `${dataDir}/raw`,
    reportsDir: `${dataDir}/reports`,
    stageDir: `${dataDir}/stage`,
  };
}

export async function ensureImportDirs(paths: ImportPaths): Promise<void> {
  await Promise.all([
    mkdir(paths.manualDir, { recursive: true }),
    mkdir(`${paths.dataDir}/mappings`, { recursive: true }),
    mkdir(paths.rawDir, { recursive: true }),
    mkdir(paths.reportsDir, { recursive: true }),
    mkdir(paths.stageDir, { recursive: true }),
  ]);
}

export async function fetchCachedText(
  path: string,
  url: string,
  refreshRaw: boolean,
): Promise<string> {
  if (!refreshRaw) {
    const cached = await readTextIfExists(path);

    if (cached != null) {
      return cached;
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${String(response.status)}`);
  }

  const text = await response.text();
  await Bun.write(path, text);

  return text;
}

export async function fetchCachedZipText(
  path: string,
  url: string,
  fileName: string,
  refreshRaw: boolean,
): Promise<string> {
  const textPath = path.replace(/\.zip$/u, ".txt");

  if (!refreshRaw) {
    const cached = await readTextIfExists(textPath);

    if (cached != null) {
      return cached;
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${String(response.status)}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await Bun.write(path, bytes);

  const text = extractZipText(bytes, fileName);
  await Bun.write(textPath, text);

  return text;
}

export async function readJsonFile<TValue>(path: string, fallback: TValue): Promise<TValue> {
  const text = await readTextIfExists(path);

  if (text == null) {
    return fallback;
  }

  return JSON.parse(text) as TValue;
}

export async function readMappings(path: string): Promise<Map<string, ImportMapping>> {
  const mappings = await readJsonFile<ImportMapping[]>(path, []);

  return new Map(mappings.map((mapping) => [mappingKey(mapping.entityType, mapping.sourceKey), mapping]));
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeMappings(
  path: string,
  mappings: Map<string, ImportMapping>,
): Promise<void> {
  await writeJsonFile(path, [...mappings.values()].sort(compareMappings));
}

export async function writeReport(paths: ImportPaths, report: ImportReport): Promise<string> {
  const stamp = report.startedAt.replaceAll(/[:.]/gu, "-");
  const path = `${paths.reportsDir}/world-data-${report.mode}-${stamp}.json`;
  report.reportPath = path;
  await writeJsonFile(path, report);

  return path;
}

export function mappingKey(entityType: string, sourceKey: string): string {
  return `${entityType}:${sourceKey}`;
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = parseDelimited(text, ",");
  const headers = rows.shift() ?? [];

  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

export function parseTsv(text: string): string[][] {
  return parseDelimited(text, "\t");
}

function extractZipText(bytes: Uint8Array, fileName: string): string {
  const entry = findZipEntry(bytes, fileName);
  const content = bytes.slice(entry.offset, entry.offset + entry.compressedSize);
  const inflated = inflateRawSync(content);

  return new TextDecoder().decode(inflated);
}

function compareMappings(left: ImportMapping, right: ImportMapping): number {
  return `${left.entityType}:${left.sourceKey}`.localeCompare(`${right.entityType}:${right.sourceKey}`);
}

function findZipEntry(bytes: Uint8Array, fileName: string): { compressedSize: number; offset: number } {
  const centralDirectoryOffset = findCentralDirectoryOffset(bytes);
  let offset = centralDirectoryOffset;

  while (offset < bytes.length - 46 && readUint32(bytes, offset) === 0x02014b50) {
    const compressedSize = readUint32(bytes, offset + 20);
    const nameLength = readUint16(bytes, offset + 28);
    const extraLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const localHeaderOffset = readUint32(bytes, offset + 42);
    const nameStart = offset + 46;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLength));

    if (name === fileName) {
      const localNameLength = readUint16(bytes, localHeaderOffset + 26);
      const localExtraLength = readUint16(bytes, localHeaderOffset + 28);

      return {
        compressedSize,
        offset: localHeaderOffset + 30 + localNameLength + localExtraLength,
      };
    }

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  throw new Error(`Could not find ${fileName} in zip file`);
}

function findCentralDirectoryOffset(bytes: Uint8Array): number {
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (readUint32(bytes, offset) === 0x06054b50) {
      return readUint32(bytes, offset + 16);
    }
  }

  throw new Error("Could not find zip central directory");
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";

    if (char === "\"") {
      const next = text[index + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
    } else {
      current += char;
    }
  }

  if (current !== "" || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0 | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

async function readTextIfExists(path: string): Promise<null | string> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  return await file.text();
}
