import { rename, rm } from "node:fs/promises";

import { fetchExternal } from "../../../external-http";
import { errorDetails, type ImportLogger } from "./logger";

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 45_000;

export async function fetchSource<T>(
  url: string,
  path: string,
  read: (response: Response) => Promise<T>,
  log?: ImportLogger,
  headers?: Record<string, string>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const startedAt = performance.now();
    const requestDetails = { attempt, path, url };
    log?.({ details: requestDetails, level: "info", message: "Downloading import source", operation: "source.fetch", stage: "building" });
    let response: Response | undefined;

    try {
      response = await fetchExternal(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Failed to fetch ${url}: ${String(response.status)}`);
      }

      const body = await read(response);
      log?.({
        details: { ...requestDetails, durationMs: Math.round(performance.now() - startedAt), status: response.status },
        level: "info",
        message: "Import source downloaded",
        operation: "source.fetch",
        stage: "building",
      });
      return body;
    } catch (error) {
      const status = response?.status;
      const retry = attempt < MAX_ATTEMPTS && (status == null || (status >= 200 && status < 300) || status === 408 || status === 429 || status >= 500);
      log?.({
        details: { ...requestDetails, ...errorDetails(error), durationMs: Math.round(performance.now() - startedAt), status },
        level: retry ? "warning" : "error",
        message: retry ? "Import source download failed, retrying" : "Import source download failed",
        operation: "source.fetch",
        stage: "building",
      });
      if (!retry) {
        throw error;
      }
      await Bun.sleep(250 * 2 ** (attempt - 1));
    }
  }
}

export async function loadCachedSource<T>(
  path: string,
  refreshRaw: boolean,
  parse: (text: string) => T,
  download: () => Promise<string>,
  log?: ImportLogger,
): Promise<T> {
  const file = Bun.file(path);
  let cached: T | undefined;
  if (await file.exists()) {
    try {
      cached = parse(await file.text());
    } catch (error) {
      log?.({
        details: { ...errorDetails(error), path },
        level: "warning",
        message: "Cached import source is invalid, downloading again",
        operation: "source.cache",
        stage: "building",
      });
    }
  }

  if (cached !== undefined && !refreshRaw) {
    log?.({ details: { path }, level: "info", message: "Using cached source", operation: "source.cache", stage: "building" });
    return cached;
  }

  let text: string;
  let parsed: T;
  try {
    text = await download();
    parsed = parse(text);
  } catch (error) {
    if (cached === undefined) {
      throw error;
    }
    log?.({
      details: { ...errorDetails(error), path },
      level: "warning",
      message: "Source refresh failed, using cached data",
      operation: "source.cache",
      stage: "building",
    });
    return cached;
  }

  await writeSourceCache(path, text);
  return parsed;
}

export async function loadCachedText<T>(
  path: string,
  url: string,
  refreshRaw: boolean,
  parse: (text: string) => T,
  log?: ImportLogger,
): Promise<T> {
  return loadCachedSource(path, refreshRaw, parse, async () => fetchSource(url, path, async (response) => response.text(), log), log);
}

export async function fetchCachedText(path: string, url: string, refreshRaw: boolean, log?: ImportLogger): Promise<string> {
  return loadCachedText(path, url, refreshRaw, (text) => {
    const start = text.trimStart();
    if (!start || start.startsWith("<")) {
      throw new Error(`Invalid text response from ${url}`);
    }
    return text;
  }, log);
}

async function writeSourceCache(path: string, text: string): Promise<void> {
  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    await Bun.write(temporaryPath, text);
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}
