import { requireAdminCapability } from "./auth";
import { getConfig } from "./config";
import { jsonResponse, notFound } from "./http";
import { handleAdminRequest } from "./modules/admin";
import { handleDemandRequest } from "./modules/demand";
import { handleEventsRequest } from "./modules/events";
import { handleFacilitiesRequest } from "./modules/facilities";
import { handleFinanceRequest } from "./modules/finance";
import { handleFleetRequest } from "./modules/fleet";
import { handleFuelRequest, initializeFuelModule } from "./modules/fuel";
import { handleGameRequest } from "./modules/game";
import { handleImportRequest } from "./modules/import";
import { closeImportSocket, openImportSocket, receiveImportSocketMessage } from "./modules/import/runtime/websocket";
import { handleOnboardingRequest } from "./modules/onboarding";
import { handleOperationsRequest } from "./modules/operations";
import { handleProxyRequest } from "./modules/proxy";
import { handleRoutesRequest } from "./modules/routes";

const config = getConfig();

void initializeFuelModule(config);

async function routeProductRequest(request: Request, url: URL): Promise<null | Response> {
  return (
    (await handleAdminRequest(request, url, config)) ??
    (await handleImportRequest(request, url, config)) ??
    (await handleDemandRequest(request, url, config)) ??
    (await handleFacilitiesRequest(request, url, config)) ??
    (await handleEventsRequest(request, url, config)) ??
    (await handleOnboardingRequest(request, url, config)) ??
    (await handleFleetRequest(request, url, config)) ??
    (await handleFuelRequest(request, url, config)) ??
    (await handleRoutesRequest(request, url, config)) ??
    (await handleOperationsRequest(request, url, config)) ??
    (await handleFinanceRequest(request, url, config)) ??
    (await handleGameRequest(request, url, config))
  );
}

async function routeRequest(request: Request, url: URL): Promise<Response> {
  return (
    (await routeProductRequest(request, url)) ??
    (await handleProxyRequest(request, url, config)) ??
    notFound()
  );
}

Bun.serve<{ jobId: null | string }>({
  async fetch(request, bunServer) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "airlinesim-bff",
      });
    }

    try {
      if (request.method === "GET" && url.pathname === "/admin/import/world-data/ws") {
        const token = url.searchParams.get("token");
        const authRequest = new Request(request, {
          headers: token ? { Authorization: `Bearer ${token}` } : request.headers,
        });
        const authError = await requireAdminCapability(authRequest, config, "world.manage");
        if (authError) {
          return authError;
        }
        if (bunServer.upgrade(request, { data: { jobId: url.searchParams.get("jobId") } })) {
          return;
        }
        return jsonResponse({ error: "WebSocket upgrade failed" }, { status: 400 });
      }

      return await routeRequest(request, url);
    } catch (error) {
      console.error("Unhandled BFF request error", request.method, url.pathname, error);
      return jsonResponse(
        {
          error: {
            code: "BFF_INTERNAL_ERROR",
            message: "The application service could not complete the request.",
            retryable: true,
          },
        },
        { status: 500 },
      );
    }
  },
  idleTimeout: config.idleTimeoutSeconds,
  port: config.port,
  websocket: {
    close(socket) {
      closeImportSocket(socket);
    },
    message(socket, message) {
      receiveImportSocketMessage(socket, message);
    },
    open(socket) {
      openImportSocket(socket);
    },
  },
});

console.warn(`BFF listening on http://localhost:${String(config.port)}`);
