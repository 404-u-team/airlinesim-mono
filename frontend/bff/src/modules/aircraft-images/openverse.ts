import type { AircraftVisualImage } from "./storage";

// Openverse (openverse.org) image search — a secondary source of aircraft type
// photos that aggregates openly-licensed images from Flickr, Wikimedia Commons
// and others behind a single API. Used alongside the Wikipedia/Wikidata lookups
// in the admin image picker.
//
// Auth: client-credentials. A long-lived client id/secret (from
// POST /v1/auth_tokens/register/) is exchanged for a ~12h bearer token, cached
// in memory and refreshed on expiry. When no credentials are configured we fall
// back to anonymous requests, which the API still serves at a lower rate limit.

const API_BASE = "https://api.openverse.org/v1";
const TOKEN_REFRESH_SKEW_MS = 60_000;
const RESULT_LIMIT = 5;

type OpenverseImageResult = {
  creator?: string;
  foreign_landing_url?: string;
  license?: string;
  source?: string;
  title?: string;
  url?: string;
};

type OpenverseSearchResponse = {
  results?: OpenverseImageResult[];
};

type OpenverseTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

let cachedToken: null | { expiresAt: number; value: string } = null;

export async function searchOpenverseCandidates(query: string, signal?: AbortSignal): Promise<AircraftVisualImage[]> {
  try {
    const url = new URL(`${API_BASE}/images/`);
    url.searchParams.set("q", query);
    url.searchParams.set("page_size", String(RESULT_LIMIT));
    url.searchParams.set("mature", "false");

    const token = await getOpenverseToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal,
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as OpenverseSearchResponse;

    return (data.results ?? [])
      .filter((item): item is OpenverseImageResult & { url: string } => Boolean(item.url))
      .map((item) => ({
        imageUrl: item.url,
        pageUrl: item.foreign_landing_url,
        searchQuery: query,
        source: openverseSourceLabel(item),
        title: item.title ?? query,
      }));
  } catch (err) {
    console.warn(`[BFF/Openverse] Failed to search images for "${query}":`, err);
    return [];
  }
}

async function getOpenverseToken(): Promise<null | string> {
  const clientId = Bun.env.OPENVERSE_CLIENT_ID;
  const clientSecret = Bun.env.OPENVERSE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  try {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    });
    const response = await fetch(`${API_BASE}/auth_tokens/token/`, {
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as OpenverseTokenResponse;
    if (!data.access_token) {
      return null;
    }

    const ttlMs = Math.max(0, (data.expires_in ?? 0) * 1000 - TOKEN_REFRESH_SKEW_MS);
    // eslint-disable-next-line require-atomic-updates
    cachedToken = { expiresAt: Date.now() + ttlMs, value: data.access_token };

    return data.access_token;
  } catch {
    return null;
  }
}

function openverseSourceLabel(item: OpenverseImageResult): string {
  const provider = item.source ? `Openverse/${item.source}` : "Openverse";
  const credit = item.creator ? ` · ${item.creator}` : "";
  const license = item.license ? ` (CC ${item.license.toUpperCase()})` : "";

  return `${provider}${credit}${license}`;
}
