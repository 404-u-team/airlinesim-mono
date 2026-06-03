import { getConfig } from "./config";
import { jsonResponse, notFound } from "./http";
import { handleDemandRequest } from "./modules/demand";
import { handleFleetRequest } from "./modules/fleet";
import { handleGameRequest } from "./modules/game";
import { handleImportRequest } from "./modules/import";
import { handleOnboardingRequest } from "./modules/onboarding";
import { handleOperationsRequest } from "./modules/operations";
import { handleProxyRequest } from "./modules/proxy";
import { handleRoutesRequest } from "./modules/routes";

const config = getConfig();

Bun.serve({
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "airlinesim-bff",
      });
    }

    return (
      (await handleImportRequest(request, url, config)) ??
      (await handleDemandRequest(request, url, config)) ??
      (await handleOnboardingRequest(request, url, config)) ??
      (await handleFleetRequest(request, url, config)) ??
      (await handleRoutesRequest(request, url, config)) ??
      (await handleOperationsRequest(request, url, config)) ??
      (await handleGameRequest(request, url, config)) ??
      (await handleProxyRequest(request, url, config)) ??
      notFound()
    );
  },
  port: config.port,
});

console.warn(`BFF listening on http://localhost:${String(config.port)}`);
