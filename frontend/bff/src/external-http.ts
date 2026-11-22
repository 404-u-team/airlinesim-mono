import { readDocument, writeDocument } from "./db/database";

const PROXY_SETTING = "external-http-proxy";

export async function fetchExternal(url: string | URL, init?: RequestInit): Promise<Response> {
  const proxy = getExternalProxy();
  if (!proxy) {
    return fetch(url, init);
  }

  try {
    return await fetch(url, { ...init, proxy });
  } catch (error) {
    // Bun errors can include connection details. Avoid exposing the proxy URL or credentials in import logs.
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : undefined;
    const reason = status === undefined ? "" : ` (HTTP ${String(status)})`;
    // eslint-disable-next-line preserve-caught-error -- the original error may include proxy credentials.
    throw new Error(`External request through the configured proxy failed${reason}`);
  }
}

export function getExternalProxy(): null | string {
  return readDocument<null | string>(PROXY_SETTING, null);
}

export function parseExternalProxy(value: unknown): null | string | undefined {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || !/^https?:\/\//iu.test(value.trim())) {
    return undefined;
  }

  const url = URL.parse(value.trim());
  if (url?.pathname !== "/" || url.href.includes("?") || url.href.includes("#")) {
    return undefined;
  }
  return url.href;
}

export function setExternalProxy(proxyUrl: null | string): void {
  writeDocument(PROXY_SETTING, proxyUrl);
}
