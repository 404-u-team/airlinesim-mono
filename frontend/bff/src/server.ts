import { getConfig } from "./config";
import { jsonResponse, notFound } from "./http";
import { handleDemandRequest } from "./modules/demand";
import { handleGameRequest } from "./modules/game";
import { handleImportRequest } from "./modules/import";
import { handleProxyRequest } from "./modules/proxy";

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
      (await handleGameRequest(request, url, config)) ??
      (await handleProxyRequest(request, url, config)) ??
      notFound()
    );
  },
  port: config.port,
});

console.warn(`BFF listening on http://localhost:${String(config.port)}`);
