/* eslint-disable max-lines, perfectionist/sort-maps */

export type DemoAircraft = {
  base_airport_id: string;
  current_maintenance_points: number;
  id: string;
  max_maintenance_points_cached: number;
  status: string;
  tail_number: string;
  type_id: string;
};

export type DemoAircraftType = {
  base_maintenance_points: number;
  cruising_speed_kph: number;
  fuel_consumption_per_hour: number;
  iata_code: string;
  icao_code: string;
  id: string;
  maint_cost_per_flight_hour: number;
  max_planned_seat_capacity: number;
  max_range_km: number;
  min_runway_length_m: number;
  model_name: string;
  price_per_unit: number;
};

export type DemoAirline = {
  balance: number;
  credit_rating: number;
  iata_code: string;
  icao_code: string;
  id: string;
  is_bankrupt: boolean;
  name: string;
  reputation: number;
  safety_rating: number;
  starting_airport_id: string;
};

export type DemoAirport = {
  fuel_price_multiplier: number;
  gate_fee: number;
  geog: string;
  iata_code: string;
  icao_code: string;
  id: string;
  intl_name: string;
  local_name: string;
  max_runway_length_m: number;
  max_runway_uses_per_day: number;
  region_id: string;
  runway_fee: number;
  stand_fee: number;
  turnaround_point_price: number;
  works_at_night: boolean;
};

export type DemoFlight = {
  aircraft_id: string;
  aircraft_tail_number: string;
  arrival_time: string;
  destination_airport_id: string;
  destination_label: string;
  distance_km: number;
  flight_number: string;
  id: string;
  load_factor: number;
  origin_airport_id: string;
  origin_label: string;
  passengers: number;
  profit: number;
  revenue: number;
  status: string;
};

export type DemoRegion = {
  business_score: number;
  country_id: string;
  gdp_per_capita: number;
  id: string;
  intl_name: string;
  local_name: string;
  population: number;
  tourism_score: number;
};

export type DemoRegionLink = {
  base_daily_demand_ab: number;
  base_daily_demand_ba: number;
  business: number;
  diaspora: number;
  id: string;
  region_a: string;
  region_b: string;
  tourism: number;
};

type DemoSnapshot = {
  aircrafts: DemoAircraft[];
  aircraftTypes: DemoAircraftType[];
  airline: DemoAirline;
  airports: DemoAirport[];
  flights: DemoFlight[];
  regionLinks: DemoRegionLink[];
  regions: DemoRegion[];
};

export const demoAccessToken = "airlinesim-demo-token";

const state: DemoSnapshot = {
  aircrafts: [
    {
      base_airport_id: "apt-ist",
      current_maintenance_points: 910,
      id: "ac-demo-1",
      max_maintenance_points_cached: 1000,
      status: "ready",
      tail_number: "TC-MVP",
      type_id: "type-a320",
    },
    {
      base_airport_id: "apt-ist",
      current_maintenance_points: 780,
      id: "ac-demo-2",
      max_maintenance_points_cached: 1000,
      status: "ready",
      tail_number: "TC-SIM",
      type_id: "type-e190",
    },
  ],
  aircraftTypes: [
    {
      base_maintenance_points: 1000,
      cruising_speed_kph: 830,
      fuel_consumption_per_hour: 2500,
      iata_code: "320",
      icao_code: "A320",
      id: "type-a320",
      maint_cost_per_flight_hour: 1250,
      max_planned_seat_capacity: 180,
      max_range_km: 6100,
      min_runway_length_m: 2100,
      model_name: "Airbus A320neo",
      price_per_unit: 110_000_000,
    },
    {
      base_maintenance_points: 950,
      cruising_speed_kph: 820,
      fuel_consumption_per_hour: 1750,
      iata_code: "E90",
      icao_code: "E190",
      id: "type-e190",
      maint_cost_per_flight_hour: 820,
      max_planned_seat_capacity: 114,
      max_range_km: 4500,
      min_runway_length_m: 1750,
      model_name: "Embraer E190",
      price_per_unit: 58_000_000,
    },
    {
      base_maintenance_points: 1200,
      cruising_speed_kph: 905,
      fuel_consumption_per_hour: 5600,
      iata_code: "789",
      icao_code: "B789",
      id: "type-b789",
      maint_cost_per_flight_hour: 3100,
      max_planned_seat_capacity: 296,
      max_range_km: 13_500,
      min_runway_length_m: 2800,
      model_name: "Boeing 787-9",
      price_per_unit: 292_000_000,
    },
  ],
  airline: {
    balance: 84_500_000,
    credit_rating: 72,
    iata_code: "MV",
    icao_code: "MVP",
    id: "airline-demo",
    is_bankrupt: false,
    name: "MVP Airways",
    reputation: 64,
    safety_rating: 89,
    starting_airport_id: "apt-ist",
  },
  airports: [
    {
      fuel_price_multiplier: 1.02,
      gate_fee: 9800,
      geog: "POINT (28.752 41.276)",
      iata_code: "IST",
      icao_code: "LTFM",
      id: "apt-ist",
      intl_name: "Istanbul Airport",
      local_name: "Istanbul Airport",
      max_runway_length_m: 4100,
      max_runway_uses_per_day: 720,
      region_id: "reg-istanbul",
      runway_fee: 4200,
      stand_fee: 1800,
      turnaround_point_price: 24,
      works_at_night: true,
    },
    {
      fuel_price_multiplier: 1.08,
      gate_fee: 14_500,
      geog: "POINT (2.55 49.009)",
      iata_code: "CDG",
      icao_code: "LFPG",
      id: "apt-cdg",
      intl_name: "Paris Charles de Gaulle",
      local_name: "Charles de Gaulle",
      max_runway_length_m: 4215,
      max_runway_uses_per_day: 820,
      region_id: "reg-paris",
      runway_fee: 6100,
      stand_fee: 2400,
      turnaround_point_price: 31,
      works_at_night: true,
    },
    {
      fuel_price_multiplier: 1.04,
      gate_fee: 13_200,
      geog: "POINT (-0.454 51.47)",
      iata_code: "LHR",
      icao_code: "EGLL",
      id: "apt-lhr",
      intl_name: "London Heathrow",
      local_name: "Heathrow",
      max_runway_length_m: 3902,
      max_runway_uses_per_day: 760,
      region_id: "reg-london",
      runway_fee: 5900,
      stand_fee: 2500,
      turnaround_point_price: 34,
      works_at_night: false,
    },
    {
      fuel_price_multiplier: 0.98,
      gate_fee: 7600,
      geog: "POINT (55.365 25.253)",
      iata_code: "DXB",
      icao_code: "OMDB",
      id: "apt-dxb",
      intl_name: "Dubai International",
      local_name: "Dubai International",
      max_runway_length_m: 4447,
      max_runway_uses_per_day: 880,
      region_id: "reg-dubai",
      runway_fee: 3400,
      stand_fee: 1500,
      turnaround_point_price: 21,
      works_at_night: true,
    },
  ],
  flights: [],
  regionLinks: [
    {
      base_daily_demand_ab: 620,
      base_daily_demand_ba: 590,
      business: 0.74,
      diaspora: 0.42,
      id: "link-ist-paris",
      region_a: "reg-istanbul",
      region_b: "reg-paris",
      tourism: 0.82,
    },
    {
      base_daily_demand_ab: 540,
      base_daily_demand_ba: 515,
      business: 0.8,
      diaspora: 0.38,
      id: "link-ist-london",
      region_a: "reg-istanbul",
      region_b: "reg-london",
      tourism: 0.68,
    },
    {
      base_daily_demand_ab: 710,
      base_daily_demand_ba: 740,
      business: 0.86,
      diaspora: 0.51,
      id: "link-ist-dubai",
      region_a: "reg-istanbul",
      region_b: "reg-dubai",
      tourism: 0.77,
    },
  ],
  regions: [
    {
      business_score: 0.72,
      country_id: "tr",
      gdp_per_capita: 17_000,
      id: "reg-istanbul",
      intl_name: "Istanbul",
      local_name: "Istanbul",
      population: 15_900_000,
      tourism_score: 0.86,
    },
    {
      business_score: 0.82,
      country_id: "fr",
      gdp_per_capita: 47_000,
      id: "reg-paris",
      intl_name: "Paris",
      local_name: "Paris",
      population: 12_200_000,
      tourism_score: 0.93,
    },
    {
      business_score: 0.9,
      country_id: "gb",
      gdp_per_capita: 54_000,
      id: "reg-london",
      intl_name: "London",
      local_name: "London",
      population: 14_800_000,
      tourism_score: 0.88,
    },
    {
      business_score: 0.87,
      country_id: "ae",
      gdp_per_capita: 51_000,
      id: "reg-dubai",
      intl_name: "Dubai",
      local_name: "Dubai",
      population: 3_700_000,
      tourism_score: 0.9,
    },
  ],
};

export function getDemoSnapshot(): DemoSnapshot {
  return state;
}

export function isDemoAuthorization(authorization: null | string): boolean {
  return authorization === `Bearer ${demoAccessToken}`;
}

export function launchDemoFlight(input: {
  aircraft_id?: string;
  destination_airport_id?: string;
}): DemoFlight {
  const aircraft = state.aircrafts.find((item) => item.id === input.aircraft_id) ?? state.aircrafts[0];
  const origin = state.airports.find((airport) => airport.id === aircraft?.base_airport_id) ?? state.airports[0];
  const destination =
    state.airports.find((airport) => airport.id === input.destination_airport_id && airport.id !== origin?.id) ??
    state.airports.find((airport) => airport.id !== origin?.id);

  if (!aircraft || !origin || !destination) {
    throw new Error("Demo flight cannot be launched without aircraft and airports");
  }

  const distance = estimateDistanceKm(origin, destination);
  const passengers = Math.round(96 + Math.random() * 68);
  const revenue = passengers * Math.max(120, distance * 0.16);
  const profit = Math.round(revenue - distance * 7.8);
  const flight: DemoFlight = {
    aircraft_id: aircraft.id,
    aircraft_tail_number: aircraft.tail_number,
    arrival_time: new Date(Date.now() + Math.max(70, distance / 12) * 60_000).toISOString(),
    destination_airport_id: destination.id,
    destination_label: airportLabel(destination),
    distance_km: distance,
    flight_number: `MV ${String(100 + state.flights.length + 1)}`,
    id: `flight-demo-${String(state.flights.length + 1)}`,
    load_factor: Math.min(0.98, passengers / 180),
    origin_airport_id: origin.id,
    origin_label: airportLabel(origin),
    passengers,
    profit,
    revenue: Math.round(revenue),
    status: "airborne",
  };

  aircraft.status = "airborne";
  aircraft.current_maintenance_points = Math.max(0, aircraft.current_maintenance_points - 22);
  state.airline.balance += profit;
  state.flights.unshift(flight);

  return flight;
}

export function purchaseDemoAircraft(input: {
  aircraft_type_id?: string;
  base_airport_id?: string;
  tail_number?: string;
}): DemoAircraft {
  const aircraftType = state.aircraftTypes.find((type) => type.id === input.aircraft_type_id);
  const baseAirport = state.airports.find((airport) => airport.id === input.base_airport_id);

  if (!aircraftType || !baseAirport || !input.tail_number) {
    throw new Error("aircraft_type_id, base_airport_id and tail_number are required");
  }

  const aircraft: DemoAircraft = {
    base_airport_id: baseAirport.id,
    current_maintenance_points: aircraftType.base_maintenance_points,
    id: `ac-demo-${String(state.aircrafts.length + 1)}`,
    max_maintenance_points_cached: aircraftType.base_maintenance_points,
    status: "ready",
    tail_number: input.tail_number,
    type_id: aircraftType.id,
  };

  state.aircrafts.push(aircraft);
  state.airline.balance -= aircraftType.price_per_unit;

  return aircraft;
}

function airportLabel(airport: DemoAirport): string {
  return `${airport.iata_code} - ${airport.intl_name}`;
}

function estimateDistanceKm(origin: DemoAirport, destination: DemoAirport): number {
  const knownDistances = new Map<string, number>([
    ["apt-ist:apt-cdg", 2250],
    ["apt-ist:apt-lhr", 2490],
    ["apt-ist:apt-dxb", 3030],
  ]);
  const directKey = `${origin.id}:${destination.id}`;
  const reverseKey = `${destination.id}:${origin.id}`;

  return knownDistances.get(directKey) ?? knownDistances.get(reverseKey) ?? 1800;
}
