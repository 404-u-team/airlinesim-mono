import { requireAdminCapability } from "./auth";
import { getConfig } from "./config";
import { jsonResponse, notFound } from "./http";
import { handleAdminRequest } from "./modules/admin";
import { handleDemandRequest } from "./modules/demand";
import { handleEventsRequest } from "./modules/events";
import { handleFacilitiesRequest } from "./modules/facilities";
import { handleFinanceRequest } from "./modules/finance";
import { handleFleetRequest } from "./modules/fleet";
import { closeFuelSocket, handleFuelRequest, initializeFuelModule, openFuelSocket } from "./modules/fuel";
import { handleGameRequest } from "./modules/game";
import { handleHubsRequest } from "./modules/hubs";
import { handleImportRequest } from "./modules/import";
import { closeImportSocket, openImportSocket, receiveImportSocketMessage } from "./modules/import/runtime/websocket";
import { handleOnboardingRequest } from "./modules/onboarding";
import { handleOperationsRequest } from "./modules/operations";
import { handleProxyRequest } from "./modules/proxy";
import { handleRoutesRequest } from "./modules/routes";

const config = getConfig();

void initializeFuelModule(config);

async function routeGameplayRequest(request: Request, url: URL): Promise<null | Response> {
  return (
    (await handleFleetRequest(request, url, config)) ??
    (await handleFuelRequest(request, url, config)) ??
    (await handleHubsRequest(request, url, config)) ??
    (await handleRoutesRequest(request, url, config)) ??
    (await handleOperationsRequest(request, url, config)) ??
    (await handleFinanceRequest(request, url, config)) ??
    (await handleGameRequest(request, url, config))
  );
}

async function routeProductRequest(request: Request, url: URL): Promise<null | Response> {
  return (await routeWorldRequest(request, url)) ?? (await routeGameplayRequest(request, url));
}

async function routeRequest(request: Request, url: URL): Promise<Response> {
  return (
    (await routeProductRequest(request, url)) ??
    (await handleProxyRequest(request, url, config)) ??
    notFound()
  );
}

async function routeWorldRequest(request: Request, url: URL): Promise<null | Response> {
  return (
    (await handleAdminRequest(request, url, config)) ??
    (await handleImportRequest(request, url, config)) ??
    (await handleDemandRequest(request, url, config)) ??
    (await handleFacilitiesRequest(request, url, config)) ??
    (await handleEventsRequest(request, url, config)) ??
    (await handleOnboardingRequest(request, url, config))
  );
}

Bun.serve<{ jobId: null | string; type: string }>({
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
        if (bunServer.upgrade(request, { data: { jobId: url.searchParams.get("jobId"), type: "import" } })) {
          return;
        }
        return jsonResponse({ error: "WebSocket upgrade failed" }, { status: 400 });
      }

      if (request.method === "GET" && url.pathname === "/fuel/ws") {
        if (bunServer.upgrade(request, { data: { jobId: null, type: "fuel" } })) {
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
      if (socket.data.type === "import") {
        closeImportSocket(socket);
      } else if (socket.data.type === "fuel") {
        closeFuelSocket(socket);
      }
    },
    message(socket, message) {
      if (socket.data.type === "import") {
        receiveImportSocketMessage(socket, message);
      }
    },
    open(socket) {
      if (socket.data.type === "import") {
        openImportSocket(socket);
      } else if (socket.data.type === "fuel") {
        openFuelSocket(socket);
      }
    },
  },
});

console.warn(`BFF listening on http://localhost:${String(config.port)}`);
