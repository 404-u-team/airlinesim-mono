import { readDocument, writeDocument } from "../../db/database";

export type AircraftImageMap = Record<string, AircraftVisualImage>;

// A resolved aircraft visual image. Stored per ICAO code in the BFF SQLite
// document store under the "aircraft-images" key. This overlay lets the BFF
// attach images to aircraft types at serve time without any backend schema
// change (the game backend has no aircraft-type update endpoint).
export type AircraftVisualImage = {
  // Locally cached, optimized copy of `imageUrl`. When `cachedEtag` is set the
  // BFF serves the bytes itself; the remote `imageUrl` is kept only as the
  // re-download source and as a fallback when the cache is missing.
  cachedAt?: string;
  cachedEtag?: string;
  cachedSourceUrl?: string;
  commonsFile?: string;
  imageUrl: string;
  pageUrl?: string;
  qid?: string;
  searchQuery?: string;
  source?: string;
  title?: string;
};

const DOCUMENT_NAME = "aircraft-images";

let memo: AircraftImageMap | null = null;

// Public URL the client should load for an aircraft type. Prefers the locally
// cached, optimized WebP served by the BFF (same-origin, long-cacheable) and
// falls back to the remote source URL when no cache has been built yet.
export function getAircraftImageUrl(icaoCode: string | undefined): string | undefined {
  if (!icaoCode) {
    return undefined;
  }

  const code = icaoCode.toUpperCase();
  const image = readAircraftImages()[code];

  if (!image) {
    return undefined;
  }

  if (image.cachedEtag) {
    return `${publicBaseUrl()}/aircraft-images/file/${encodeURIComponent(code)}.webp?v=${image.cachedEtag}`;
  }

  return image.imageUrl;
}

export function readAircraftImages(): AircraftImageMap {
  if (memo) {
    return memo;
  }

  const stored = readDocument<AircraftImageMap>(DOCUMENT_NAME, {});
  memo = stored;

  return stored;
}

export function writeAircraftImages(images: AircraftImageMap): void {
  writeDocument(DOCUMENT_NAME, images);
  memo = images;
}

function publicBaseUrl(): string {
  const explicit = Bun.env.BFF_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (explicit) {
    return explicit;
  }

  return `http://localhost:${Bun.env.BFF_PORT ?? "4200"}`;
}
