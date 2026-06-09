import type { FuelPriceSnapshot } from "./price";

type FuelSocket = {
  send: (data: string) => unknown;
};

const sockets = new Set<FuelSocket>();

export function broadcastFuelPriceChanged(snapshot: FuelPriceSnapshot): void {
  const message = JSON.stringify({
    price: snapshot.price,
    recorded_at: snapshot.recorded_at,
    type: "fuel_price_changed",
  });
  for (const socket of sockets) {
    try {
      socket.send(message);
    } catch {
      // Ignore failures
    }
  }
}

export function closeFuelSocket(socket: FuelSocket): void {
  sockets.delete(socket);
}

export function openFuelSocket(socket: FuelSocket): void {
  sockets.add(socket);
}
