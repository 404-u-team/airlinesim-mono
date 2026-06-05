import type { BffConfig } from "../../config";

import { jsonResponse } from "../../http";
import { getFuelPriceHistory, getFuelPriceSnapshot, loadFuelPriceStore } from "./price";
import { startFuelRealtime } from "./realtime";

export async function handleFuelRequest(
  request: Request,
  url: URL,
  _config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/fuel/")) {
    return null;
  }

  if (request.method === "GET" && url.pathname === "/fuel/price") {
    return jsonResponse(await getFuelPriceSnapshot());
  }

  if (request.method === "GET" && url.pathname === "/fuel/history") {
    return jsonResponse({ history: await getFuelPriceHistory() });
  }

  return jsonResponse({ error: { code: "FUEL_NOT_FOUND", message: "Fuel endpoint not found." } }, { status: 404 });
}

export async function initializeFuelModule(config: BffConfig): Promise<void> {
  await loadFuelPriceStore();
  startFuelRealtime(config);
}
