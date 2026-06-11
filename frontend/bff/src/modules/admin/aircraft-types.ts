import type { BffConfig } from "../../config";

import { requireAdminCapability } from "../../auth";
import { jsonResponse } from "../../http";
import {
  cacheAircraftImage,
  cachedImageContentType,
  cachedImagePath,
  removeCachedAircraftImage,
} from "../aircraft-images/cache";
import { searchAircraftImageCandidates } from "../aircraft-images/fetch";
import {
  type AircraftVisualImage,
  readAircraftImages,
  writeAircraftImages,
} from "../aircraft-images/storage";

const imageRegex = /^\/admin\/aircraft-types\/([^/]+)\/image$/;
const imageFileRegex = /^\/aircraft-images\/file\/([^/]+?)(?:\.webp)?$/;

export async function handleAdminAircraftTypesRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  const { pathname } = url;
  const isSearch = pathname === "/admin/aircraft-types/images/search";
  const match = imageRegex.exec(pathname);

  if (!isSearch && !match) {
    return null;
  }

  const authError = await requireAdminCapability(request, config, "world.manage");
  if (authError) {
    return authError;
  }

  if (isSearch) {
    return handleSearchImages(request, url);
  }

  if (match?.[1]) {
    return handleOverrideImage(request, match[1].toUpperCase());
  }

  return null;
}

// Serves the locally cached, optimized WebP for an aircraft type. Public (no
// admin capability required) so <img> tags can load it directly; matched before
// the admin routes in the server.
export function handleAircraftImageFileRequest(request: Request, url: URL): null | Response {
  const match = imageFileRegex.exec(url.pathname);
  if (!match?.[1]) {
    return null;
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }

  const icao = match[1].toUpperCase();
  const filePath = cachedImagePath(icao);
  if (!filePath) {
    return jsonResponse({ error: "Not found" }, { status: 404 });
  }

  return new Response(Bun.file(filePath), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": cachedImageContentType(),
    },
  });
}

async function handleOverrideImage(request: Request, icao: string): Promise<Response> {
  if (request.method === "PUT") {
    const body = (await request.json().catch(() => ({}))) as Partial<AircraftVisualImage>;
    if (!body.imageUrl) {
      return jsonResponse({ error: "imageUrl is required" }, { status: 400 });
    }

    const entry: AircraftVisualImage = {
      commonsFile: body.commonsFile,
      imageUrl: body.imageUrl,
      pageUrl: body.pageUrl,
      qid: body.qid,
      searchQuery: body.searchQuery,
      source: body.source,
      title: body.title,
    };

    // Build the optimized local copy before persisting, so a successful save
    // always points at servable cache metadata. If caching fails we still store
    // the entry and fall back to the remote URL.
    try {
      const cached = await cacheAircraftImage(icao, body.imageUrl);
      entry.cachedAt = new Date().toISOString();
      entry.cachedEtag = cached.etag;
      entry.cachedSourceUrl = cached.sourceUrl;
    } catch {
      await removeCachedAircraftImage(icao);
    }

    const map = readAircraftImages();
    map[icao] = entry;
    writeAircraftImages(map);
    return jsonResponse(entry);
  }

  if (request.method === "DELETE") {
    const map = readAircraftImages();
    const { [icao]: _, ...rest } = map;
    writeAircraftImages(rest);
    await removeCachedAircraftImage(icao);
    return jsonResponse({ success: true });
  }

  return jsonResponse({ error: "Method not allowed" }, { status: 405 });
}

async function handleSearchImages(request: Request, url: URL): Promise<Response> {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, { status: 405 });
  }
  const q = url.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return jsonResponse({ candidates: [] });
  }
  console.warn(`[BFF] Searching aircraft images for query: "${q}"`);
  try {
    const candidates = await searchAircraftImageCandidates(q, request.signal);
    console.warn(`[BFF] Found ${String(candidates.length)} candidates for query: "${q}"`);
    return jsonResponse({ candidates });
  } catch (err) {
    console.error(`[BFF] Error searching aircraft images for "${q}":`, err);
    return jsonResponse(
      { candidates: [], error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
