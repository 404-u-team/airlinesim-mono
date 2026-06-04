import type { BffConfig } from "../../config";

import { getUserAuthorization } from "../../auth";
import { BackendHttpError, requestBackend } from "../../backend-http";
import { jsonResponse } from "../../http";
import { cache } from "../proxy";
import { adminActorId, recordAdminAudit } from "./audit";

const worldResources: Record<string, string> = {
  airports: "airport",
  countries: "country",
  "region-links": "region-link",
  regions: "region",
};

export async function handleAdminWorldRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  const match = /^\/admin\/world\/([^/]+)(?:\/([^/]+))?$/.exec(url.pathname);
  const collection = match?.[1];
  const resource = collection ? worldResources[collection] : undefined;

  if (!resource) {
    return null;
  }

  const id = match?.[2] ? decodeURIComponent(match[2]) : undefined;

  try {
    const response = await forwardWorldRequest(request, url, config, collection ?? "", resource, id);
    if (response.ok && request.method !== "GET") {
      cache.clear();
    }
    await auditWorldRequest(request, resource, id, response.ok);
    return cloneResponse(response);
  } catch (error) {
    await auditWorldRequest(request, resource, id, false);
    return error instanceof BackendHttpError
      ? jsonResponse(error.toNormalizedJson(), { status: error.status })
      : jsonResponse({ error: { code: "ADMIN_WORLD_ERROR", message: "World data request failed." } }, { status: 500 });
  }
}

async function auditWorldRequest(request: Request, resource: string, id: string | undefined, success: boolean): Promise<void> {
  if (request.method === "GET") {
    return;
  }

  try {
    await recordAdminAudit({
      action: request.method.toLowerCase(),
      capability: "world.manage",
      entity_id: id,
      entity_type: resource,
      success,
      user_id: adminActorId(request),
    });
  } catch (error) {
    console.warn("Admin audit write failed:", error);
  }
}

function backendWorldPath(url: URL, collection: string, resource: string, id: string | undefined, method: string): string {
  if (method === "GET" && !id) {
    return `/${collection}${url.search}`;
  }

  return id ? `/${resource}/${encodeURIComponent(id)}` : `/${resource}`;
}

function cloneResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");
  headers.delete("Content-Length");

  return new Response(response.body, { headers, status: response.status, statusText: response.statusText });
}

async function forwardWorldRequest(
  request: Request,
  url: URL,
  config: BffConfig,
  collection: string,
  resource: string,
  id: string | undefined,
): Promise<Response> {
  const contentType = request.headers.get("Content-Type");

  return requestBackend(config, backendWorldPath(url, collection, resource, id, request.method), {
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    headers: contentType ? { "Content-Type": contentType } : undefined,
    maxAttempts: request.method === "GET" ? undefined : 1,
    method: request.method as "DELETE" | "GET" | "PATCH" | "POST" | "PUT",
    token: getUserAuthorization(request) ?? undefined,
  });
}
