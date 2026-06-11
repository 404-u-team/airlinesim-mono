// Auto-cancels flights whose aircraft was not at the departure airport when the
// flight was due out (e.g. a one-way leg moved it to another hub and no return was
// scheduled). The schedule itself stays active: only the missed departures are lost,
// matching real operations instead of blocking the whole weekly plan.

import type { StoredFlight } from "./types";

import { recordGameEvent } from "../events/producer";

// Walks each aircraft's flights in departure order with a running position and
// cancels every departed-but-unsettled flight that does not start where the aircraft
// actually is. Cancelling a leg keeps the position unchanged, so the cascade is
// handled naturally (a cancelled outbound also cancels the dependent return).
export function autoCancelMispositionedFlights(
  flights: StoredFlight[],
  baseByAircraft: Map<string | undefined, string | undefined>,
  now = new Date(),
): { cancelled: StoredFlight[]; flights: StoredFlight[] } {
  const nowMs = now.getTime();
  const cancelledById = new Map<string, StoredFlight>();
  const byAircraft = new Map<string, StoredFlight[]>();

  for (const flight of flights) {
    byAircraft.set(flight.aircraft_id, [...(byAircraft.get(flight.aircraft_id) ?? []), flight]);
  }

  for (const [aircraftId, aircraftFlights] of byAircraft) {
    const ordered = aircraftFlights
      .filter((flight) => flight.status !== "cancelled")
      .sort((left, right) => left.departure_at.localeCompare(right.departure_at));
    let position = baseByAircraft.get(aircraftId);

    for (const flight of ordered) {
      if (new Date(flight.departure_at).getTime() > nowMs) {
        break;
      }
      // Already-settled history is accepted as flown even if the chain looks broken —
      // its money is in the ledger and retro-cancelling would corrupt it.
      const settled = Boolean(flight.actual) || flight.status === "completed";
      if (!settled && position && flight.origin_airport_id !== position) {
        cancelledById.set(flight.id, {
          ...flight,
          status: "cancelled",
          updated_at: now.toISOString(),
        });
        continue;
      }
      position = flight.destination_airport_id;
    }
  }

  if (cancelledById.size === 0) {
    return { cancelled: [], flights };
  }

  return {
    cancelled: [...cancelledById.values()],
    flights: flights.map((flight) => cancelledById.get(flight.id) ?? flight),
  };
}

export async function recordAutoCancelledFlightEvents(airlineId: string, cancelled: StoredFlight[]): Promise<void> {
  await Promise.all(cancelled.map(async (flight) =>
    recordGameEvent({
      airline_id: airlineId,
      category: "operations",
      code: "FLIGHT_AUTO_CANCELLED",
      dedupe_key: `flight-auto-cancelled:${flight.id}`,
      occurred_at: flight.departure_at,
      parameters: {
        destination_airport_id: flight.destination_airport_id,
        flight_number: flight.flight_number,
        origin_airport_id: flight.origin_airport_id,
      },
      related: { aircraft_id: flight.aircraft_id, flight_id: flight.id, route_id: flight.route_id, schedule_id: flight.schedule_id },
      severity: "warning",
      source_id: flight.id,
      source_type: "flight",
      target_path: "/operations/live-flights",
    })));
}
