import type { BffConfig } from "../../config";

import { getAdminCapabilityProbe, requireAdminCapability } from "../../auth";
import { BackendHttpError } from "../../backend-http";
import { jsonResponse } from "../../http";
import { handleAdminAirlinesRequest } from "./airlines";
import { listAdminAudit } from "./audit";
import { buildWorldReadiness } from "./readiness";
import { handleAdminWorldRequest } from "./world";

export async function handleAdminRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/admin/")) {
    return null;
  }

  try {
    if (request.method === "GET" && url.pathname === "/admin/session") {
      return jsonResponse(await getAdminCapabilityProbe(request, config));
    }
    const authError = await requireAdminCapability(request, config, "world.manage");
    if (authError) {
      return authError;
    }

    return await routeAdminRequest(request, url, config);
  } catch (error) {
    if (error instanceof BackendHttpError) {
      return jsonResponse(error.toNormalizedJson(), { status: error.status });
    }

    return jsonResponse(
      {
        error: {
          code: "ADMIN_CAPABILITY_UNAVAILABLE",
          message: "Admin capability could not be verified.",
          retryable: true,
        },
      },
      { status: 503 },
    );
  }
}

// Dispatches an authenticated admin request to the matching sub-handler.
async function routeAdminRequest(request: Request, url: URL, config: BffConfig): Promise<null | Response> {
  if (request.method === "GET" && url.pathname === "/admin/world/readiness") {
    return jsonResponse(await buildWorldReadiness(request, config));
  }
  if (request.method === "GET" && url.pathname === "/admin/audit") {
    return jsonResponse({ entries: await listAdminAudit() });
  }
  if (url.pathname.startsWith("/admin/import/")) {
    return null;
  }

  return (await handleAdminAirlinesRequest(request, url, config)) ?? (await handleAdminWorldRequest(request, url, config));
}
