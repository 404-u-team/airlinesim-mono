import { getExternalProxy, parseExternalProxy, setExternalProxy } from "../../external-http";
import { jsonResponse } from "../../http";
import { adminActorId, recordAdminAudit } from "./audit";

export async function handleExternalProxySettings(request: Request): Promise<Response> {
  if (request.method === "GET") {
    return proxyResponse(getExternalProxy());
  }
  if (request.method !== "PUT") {
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, {
      headers: { Allow: "GET, PUT" },
      status: 405,
    });
  }

  const body = (await request.json().catch(() => undefined)) as undefined | { proxyUrl?: unknown };
  const proxyUrl = parseExternalProxy(body?.proxyUrl);
  if (proxyUrl === undefined) {
    return jsonResponse({
      error: { code: "INVALID_PROXY_URL", message: "Provide an HTTP or HTTPS proxy URL, or null to remove it.", retryable: false },
    }, { status: 400 });
  }

  setExternalProxy(proxyUrl);
  await recordAdminAudit({
    action: "settings.update",
    capability: "world.manage",
    entity_type: "external-proxy",
    success: true,
    user_id: adminActorId(request),
  }).catch(() => { console.warn("External proxy settings audit write failed"); });

  return proxyResponse(proxyUrl);
}

function proxyResponse(proxyUrl: null | string): Response {
  return jsonResponse({ origin: proxyUrl ? new URL(proxyUrl).origin : null }, { headers: { "Cache-Control": "no-store" } });
}
