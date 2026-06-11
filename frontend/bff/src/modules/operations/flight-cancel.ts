import type { BffConfig } from "../../config";

import { jsonResponse } from "../../http";
import { reconcileNotificationsAfterMutation } from "../events/reconcile";
import { loadOperationsSnapshot } from "./load";
import { saveFlights } from "./storage";

export async function cancelFlight(request: Request, config: BffConfig, flightId: string): Promise<Response> {
  const snapshot = await loadOperationsSnapshot(request, config);
  const flight = snapshot.flights.find((item) => item.id === flightId);

  if (!flight) {
    return jsonResponse({ error: { code: "FLIGHT_NOT_FOUND", message: "Flight not found." } }, { status: 404 });
  }
  if (flight.status === "completed" || flight.status === "cancelled") {
    return jsonResponse(
      { error: { code: "FLIGHT_ALREADY_DONE", message: "Cannot cancel a completed or cancelled flight." } },
      { status: 409 },
    );
  }

  const cancelledFlight = {
    ...flight,
    status: "cancelled" as const,
    updated_at: new Date().toISOString(),
  };
  await saveFlights([cancelledFlight]);
  await reconcileNotificationsAfterMutation(request, config);

  return jsonResponse({ flight: cancelledFlight });
}
