import { existsSync, mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

// On-disk cache of optimized aircraft photos. Remote source images (Wikipedia /
// Wikimedia Commons) are downloaded once, re-encoded to a small WebP, and stored
// under data/aircraft-images/<ICAO>.webp. The BFF then serves these bytes itself
// (see the /aircraft-images/file route), so the client only ever pulls a small,
// same-origin, long-cacheable image instead of a full-resolution remote JPEG.

export type CachedImageResult = {
  bytes: number;
  etag: string;
  file: string;
  height?: number;
  sourceUrl: string;
  width?: number;
};

const CACHE_DIR = resolve(import.meta.dir, "../../../data/aircraft-images");
const MAX_WIDTH = 800;
const WEBP_QUALITY = 80;
const FETCH_USER_AGENT = "AirlineSim-Image-Cache/1.0";
const FETCH_TIMEOUT_MS = 15_000;

// Downloads `sourceUrl`, re-encodes it to an optimized WebP, and writes it to the
// per-ICAO cache file. Throws on fetch/decode failure so callers can fall back to
// the remote URL.
export async function cacheAircraftImage(icaoCode: string, sourceUrl: string): Promise<CachedImageResult> {
  ensureCacheDir();

  const controller = new AbortController();
  const timeout = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);

  let input: Buffer;
  try {
    const response = await fetch(sourceUrl, {
      headers: { "User-Agent": FETCH_USER_AGENT },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Source image responded ${String(response.status)}`);
    }

    input = Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }

  const optimized = await sharp(input)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  const file = filePathFor(icaoCode);
  await Bun.write(file, optimized.data);

  return {
    bytes: optimized.data.byteLength,
    etag: Bun.hash(optimized.data).toString(16),
    file,
    height: optimized.info.height,
    sourceUrl,
    width: optimized.info.width,
  };
}

export function cachedImageContentType(): string {
  return "image/webp";
}

// Absolute path to the cached WebP for an ICAO code, or null if not present.
export function cachedImagePath(icaoCode: string): null | string {
  const file = filePathFor(icaoCode);

  return existsSync(file) ? file : null;
}

// Removes the cached file for an ICAO code, if any. Safe to call when absent.
export async function removeCachedAircraftImage(icaoCode: string): Promise<void> {
  const file = filePathFor(icaoCode);
  if (existsSync(file)) {
    await unlink(file).catch(() => undefined);
  }
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function filePathFor(icaoCode: string): string {
  return resolve(CACHE_DIR, `${icaoCode.toUpperCase()}.webp`);
}
