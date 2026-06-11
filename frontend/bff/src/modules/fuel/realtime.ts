import { io, type Socket } from "socket.io-client";

import type { BffConfig } from "../../config";

import { type FuelPriceEventPayload, recordFuelPriceChange } from "./price";

let fuelSocket: null | Socket = null;

export function startFuelRealtime(config: BffConfig): void {
  if (fuelSocket) {
    return;
  }

  fuelSocket = io(config.backendBaseUrl, {
    path: "/socket.io",
    reconnection: true,
    transports: ["websocket", "polling"],
  });

  fuelSocket.on("connect", () => {
    console.warn("BFF fuel realtime connected", config.backendBaseUrl);
  });
  fuelSocket.on("connect_error", (error: Error) => {
    console.warn("BFF fuel realtime connection failed", error.message);
  });
  fuelSocket.on("fuel_price_changed", (payload: FuelPriceEventPayload) => {
    void recordFuelPriceChange(payload);
  });
}
