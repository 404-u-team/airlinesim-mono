import { getConfig } from "./config";
import { jsonResponse, notFound } from "./http";
import { handleDemandRequest } from "./modules/demand";
import { handleFinanceRequest } from "./modules/finance";
import { handleFleetRequest } from "./modules/fleet";
import { handleGameRequest } from "./modules/game";
import { handleImportRequest } from "./modules/import";
import { handleOnboardingRequest } from "./modules/onboarding";
import { handleOperationsRequest } from "./modules/operations";
import { handleProxyRequest } from "./modules/proxy";
import { handleRoutesRequest } from "./modules/routes";

const config = getConfig();

async function routeRequest(request: Request, url: URL): Promise<Response> {
  return (
    (await handleImportRequest(request, url, config)) ??
    (await handleDemandRequest(request, url, config)) ??
    (await handleOnboardingRequest(request, url, config)) ??
    (await handleFleetRequest(request, url, config)) ??
    (await handleRoutesRequest(request, url, config)) ??
    (await handleOperationsRequest(request, url, config)) ??
    (await handleFinanceRequest(request, url, config)) ??
    (await handleGameRequest(request, url, config)) ??
    (await handleProxyRequest(request, url, config)) ??
    notFound()
  );
}

Bun.serve({
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "airlinesim-bff",
      });
    }

    try {
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
  port: config.port,
});

console.warn(`BFF listening on http://localhost:${String(config.port)}`);
