// Synthesized per-flight telemetry and phases. See docs/flight-phases.md.
//
// The persisted coarse `status` (scheduled/boarding/in_flight/completed/cancelled)
// drives settlement, positioning and the ledger and is NOT changed here. This module
// is purely cosmetic/immersive: from a flight's gate-out/gate-in times and distance it
// derives the fine-grained phase (taxi/takeoff/climb/cruise/descent/landing/...) and
// plausible FL, speed, fuel-on-board, passengers-on-board and ETA. Everything is a
// deterministic function of `now`, so the BFF and the client (which ticks locally) can
// compute identical values without any extra round-trips.

// Fine-grained, display-only phases. `scheduled` precedes boarding; `arrived` follows
// deplaning. The airborne phases (takeoff..landing) map to the coarse `in_flight`.
export type FlightPhase =
  | "arrived"
  | "boarding"
  | "climb"
  | "cruise"
  | "deplaning"
  | "descent"
  | "landing"
  | "scheduled"
  | "takeoff"
  | "taxi_in"
  | "taxi_out";

export type FlightTelemetry = {
  // Fraction of the airborne flight path covered, [0, 1] — drives map interpolation.
  air_progress: number;
  altitude_ft: number;
  cruise_flight_level: number;
  eta_minutes: number;
  fuel_remaining_t: number;
  ground_speed_kph: number;
  passengers_on_board: number;
  phase: FlightPhase;
  // Fraction of gate-to-gate block time elapsed, [0, 1].
  progress: number;
};

export type TelemetryInput = {
  arrivalAt: string;
  cruiseSpeedKph: number;
  departureAt: string;
  distanceKm: number;
  fuelBurnKgPerHour: number;
  passengers: number;
};

// Passengers board over the 30 min before gate-out and deplane over 15 min after gate-in.
const BOARDING_MINUTES = 30;
const DEPLANING_MINUTES = 15;
// Ground segments (clamped to fit short blocks). Takeoff/landing are the runway roll.
const TAXI_OUT_MINUTES = 9;
const TAKEOFF_MINUTES = 1;
const LANDING_MINUTES = 1;
const TAXI_IN_MINUTES = 6;
// Climb/descent each take up to this share of the airborne time (capped in minutes).
const VERTICAL_SHARE = 0.18;
const MAX_CLIMB_MINUTES = 22;
const MAX_DESCENT_MINUTES = 24;
// Taxi speed and the slowest airborne speed (climb-out / final approach).
const TAXI_SPEED_KPH = 28;
const TERMINAL_AIR_SPEED_KPH = 280;
// Fuel reserve carried over trip burn: final-reserve fraction of trip fuel.
const FUEL_RESERVE_FRACTION = 0.12;

type Segment = { end: number; phase: FlightPhase; start: number };

// The airborne span (gear-up to touchdown roll). The map interpolates the aircraft
// position linearly between origin and destination across this window; before it the
// plane sits at the origin gate/taxi, after it at the destination. Returns ISO strings
// so the client needs no phase model — just a lerp between two timestamps.
export function airborneWindow(departureAt: string, arrivalAt: string): null | { landing_at: string; takeoff_at: string } {
  const departure = new Date(departureAt).getTime();
  const arrival = new Date(arrivalAt).getTime();

  if (!Number.isFinite(departure) || !Number.isFinite(arrival) || arrival <= departure) {
    return null;
  }

  const segments = buildSegments(departure, arrival);
  const takeoff = segments.find((segment) => segment.phase === "takeoff");
  const landing = segments.find((segment) => segment.phase === "landing");

  if (!takeoff || !landing) {
    return null;
  }

  return { landing_at: new Date(landing.end).toISOString(), takeoff_at: new Date(takeoff.start).toISOString() };
}

// Cruise altitude as a flight level (e.g. 370 ⇒ FL370 ⇒ 37 000 ft), by stage length.
export function cruiseFlightLevel(distanceKm: number): number {
  if (distanceKm < 450) {
    return 260;
  }
  if (distanceKm < 1200) {
    return 320;
  }
  if (distanceKm < 3000) {
    return 360;
  }

  return 390;
}

// The full immersive telemetry for a flight at instant `now`.
export function flightTelemetry(input: TelemetryInput, now = new Date()): FlightTelemetry {
  const departure = new Date(input.departureAt).getTime();
  const arrival = new Date(input.arrivalAt).getTime();
  const cruiseFl = cruiseFlightLevel(input.distanceKm);
  const tripFuelT = Math.max(0, (input.fuelBurnKgPerHour * blockHours(departure, arrival)) / 1000);
  const reserveT = tripFuelT * FUEL_RESERVE_FRACTION;

  if (!Number.isFinite(departure) || !Number.isFinite(arrival) || arrival <= departure) {
    return groundedTelemetry("scheduled", cruiseFl, reserveT + tripFuelT, input.passengers, 0);
  }

  const segments = buildSegments(departure, arrival);
  const nowMs = now.getTime();
  const phase = phaseAt(nowMs, departure, arrival, segments);
  const air = airborneProgress(nowMs, segments);

  return {
    air_progress: air,
    altitude_ft: Math.round(altitudeForPhase(phase, segmentProgress(nowMs, phase, segments), cruiseFl) * 100),
    cruise_flight_level: cruiseFl,
    eta_minutes: Math.max(0, Math.round((arrival - nowMs) / 60_000)),
    fuel_remaining_t: round1(reserveT + tripFuelT * (1 - air)),
    ground_speed_kph: Math.round(speedForPhase(phase, segmentProgress(nowMs, phase, segments), input.cruiseSpeedKph)),
    passengers_on_board: passengersOnBoard(nowMs, departure, arrival, phase, input.passengers),
    phase,
    progress: clamp01((nowMs - departure) / (arrival - departure)),
  };
}

function airborneProgress(now: number, segments: Segment[]): number {
  const takeoff = segments.find((segment) => segment.phase === "takeoff");
  const landing = segments.find((segment) => segment.phase === "landing");

  if (!takeoff || !landing) {
    return 0;
  }
  if (now <= takeoff.start) {
    return 0;
  }
  if (now >= landing.end) {
    return 1;
  }

  return clamp01((now - takeoff.start) / (landing.end - takeoff.start));
}

function altitudeForPhase(phase: FlightPhase, progress: number, cruiseFl: number): number {
  if (phase === "climb") {
    return cruiseFl * progress;
  }
  if (phase === "cruise") {
    return cruiseFl;
  }
  if (phase === "descent") {
    return cruiseFl * (1 - progress);
  }

  return 0;
}

function blockHours(departure: number, arrival: number): number {
  return Number.isFinite(departure) && Number.isFinite(arrival) && arrival > departure
    ? (arrival - departure) / 3_600_000
    : 1;
}

// Partitions the gate-to-gate block into ordered phase segments (epoch ms). Ground
// segments are clamped so they always fit, leaving the remainder for cruise.
function buildSegments(departure: number, arrival: number): Segment[] {
  const blockMin = (arrival - departure) / 60_000;
  const taxiOut = Math.min(TAXI_OUT_MINUTES, blockMin * 0.2);
  const taxiIn = Math.min(TAXI_IN_MINUTES, blockMin * 0.15);
  const airborneMin = Math.max(1, blockMin - taxiOut - taxiIn);
  const climb = Math.min(MAX_CLIMB_MINUTES, airborneMin * VERTICAL_SHARE);
  const descent = Math.min(MAX_DESCENT_MINUTES, airborneMin * VERTICAL_SHARE);
  const cruise = Math.max(0, airborneMin - climb - descent - TAKEOFF_MINUTES - LANDING_MINUTES);
  const durations: Array<[FlightPhase, number]> = [
    ["taxi_out", taxiOut],
    ["takeoff", TAKEOFF_MINUTES],
    ["climb", climb],
    ["cruise", cruise],
    ["descent", descent],
    ["landing", LANDING_MINUTES],
    ["taxi_in", taxiIn],
  ];

  let cursor = departure;

  return durations.map(([phase, minutes]) => {
    const start = cursor;
    cursor += minutes * 60_000;

    return { end: cursor, phase, start };
  });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function groundedTelemetry(
  phase: FlightPhase,
  cruiseFl: number,
  fuelT: number,
  passengers: number,
  air: number,
): FlightTelemetry {
  return {
    air_progress: air,
    altitude_ft: 0,
    cruise_flight_level: cruiseFl,
    eta_minutes: 0,
    fuel_remaining_t: round1(fuelT),
    ground_speed_kph: 0,
    passengers_on_board: phase === "scheduled" ? 0 : passengers,
    phase,
    progress: air,
  };
}

function passengersOnBoard(
  now: number,
  departure: number,
  arrival: number,
  phase: FlightPhase,
  passengers: number,
): number {
  if (phase === "scheduled" || phase === "arrived") {
    return 0;
  }
  if (phase === "boarding") {
    const boardStart = departure - BOARDING_MINUTES * 60_000;

    return Math.round(passengers * clamp01((now - boardStart) / (BOARDING_MINUTES * 60_000)));
  }
  if (phase === "deplaning") {
    return Math.round(passengers * (1 - clamp01((now - arrival) / (DEPLANING_MINUTES * 60_000))));
  }

  return passengers;
}

// Resolves the active phase, including the pre-departure boarding and post-arrival
// deplaning windows that sit outside the gate-to-gate segments.
function phaseAt(now: number, departure: number, arrival: number, segments: Segment[]): FlightPhase {
  if (now < departure - BOARDING_MINUTES * 60_000) {
    return "scheduled";
  }
  if (now < departure) {
    return "boarding";
  }
  if (now >= arrival + DEPLANING_MINUTES * 60_000) {
    return "arrived";
  }
  if (now >= arrival) {
    return "deplaning";
  }

  return segments.find((segment) => now < segment.end)?.phase ?? "taxi_in";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Progress within the current phase's segment, [0, 1]. Boarding/deplaning are handled
// by the caller; here only the gate-to-gate segments matter.
function segmentProgress(now: number, phase: FlightPhase, segments: Segment[]): number {
  const segment = segments.find((item) => item.phase === phase);

  if (!segment || segment.end <= segment.start) {
    return 0;
  }

  return clamp01((now - segment.start) / (segment.end - segment.start));
}

function speedForPhase(phase: FlightPhase, progress: number, cruiseSpeed: number): number {
  if (phase === "taxi_out" || phase === "taxi_in") {
    return TAXI_SPEED_KPH;
  }
  if (phase === "takeoff") {
    return TAXI_SPEED_KPH + (TERMINAL_AIR_SPEED_KPH - TAXI_SPEED_KPH) * progress;
  }
  if (phase === "climb") {
    return TERMINAL_AIR_SPEED_KPH + (cruiseSpeed - TERMINAL_AIR_SPEED_KPH) * progress;
  }
  if (phase === "cruise") {
    return cruiseSpeed;
  }
  if (phase === "descent") {
    return cruiseSpeed - (cruiseSpeed - TERMINAL_AIR_SPEED_KPH) * progress;
  }
  if (phase === "landing") {
    return TERMINAL_AIR_SPEED_KPH * (1 - progress);
  }

  return 0;
}
