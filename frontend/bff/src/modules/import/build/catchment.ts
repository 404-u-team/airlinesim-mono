import type { GeoCity } from "../runtime/sources";

import { distanceKm } from "../shared/math";

// ── Catchment population ──────────────────────────────────────────────────────
//
// Each airport gets a *catchment population*: the population it can realistically
// draw on, computed as the sum of nearby city populations weighted by a distance
// decay. This replaces admin1 (state/province) population, which was far too coarse
// (DE-NW = 23M shared by Cologne *and* tiny Paderborn). See
// docs/passenger-demand-model.md "Слой 0 — Catchment".
//
//   catchment = Σ_city pop(city) · w(distance(airport, city))
//   w(d) = 1 / (1 + (d / DECAY_R)^2)          # ~1.0 in-city, ~0.5 at DECAY_R
//
// Cities beyond CATCHMENT_RADIUS_KM are ignored. City data is GeoNames cities5000
// (already loaded as raw.geoCities), CC-BY 4.0.

export const CATCHMENT_RADIUS_KM = 150;
export const CATCHMENT_DECAY_R_KM = 35;

export type CatchmentOptions = {
  decayRKm?: number;
  radiusKm?: number;
};

// Spatial grid over cities (1°×1° cells) so catchment is O(nearby cities) per
// airport instead of O(all cities). cities5000 has ~50k rows; a naive scan over
// every airport would be ~160M haversine calls.
export type CityGrid = {
  cells: Map<string, GeoCity[]>;
};

const DEG_LAT_KM = 110.574;

export function buildCityGrid(cities: GeoCity[]): CityGrid {
  const cells = new Map<string, GeoCity[]>();

  for (const city of cities) {
    if (!Number.isFinite(city.latitude) || !Number.isFinite(city.longitude) || city.population <= 0) {
      continue;
    }
    const key = cellKey(Math.floor(city.latitude), Math.floor(city.longitude));
    const bucket = cells.get(key);
    if (bucket) {
      bucket.push(city);
    } else {
      cells.set(key, [city]);
    }
  }

  return { cells };
}

export function catchmentPopulation(
  latitude: number,
  longitude: number,
  grid: CityGrid,
  options: CatchmentOptions = {},
): number {
  const radiusKm = options.radiusKm ?? CATCHMENT_RADIUS_KM;
  const decayRKm = options.decayRKm ?? CATCHMENT_DECAY_R_KM;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return 0;
  }

  let total = 0;
  for (const city of nearbyCities(latitude, longitude, grid, radiusKm)) {
    const d = distanceKm(latitude, longitude, city.latitude, city.longitude);
    if (d > radiusKm) {
      continue;
    }
    const weight = 1 / (1 + (d / decayRKm) ** 2);
    total += city.population * weight;
  }

  return Math.round(total);
}

// Returns candidate cities from the grid cells that could fall within radiusKm of
// the point. Longitude cell span widens toward the poles (degrees shrink).
function nearbyCities(latitude: number, longitude: number, grid: CityGrid, radiusKm: number): GeoCity[] {
  const latSpan = Math.ceil(radiusKm / DEG_LAT_KM);
  const cosLat = Math.max(0.01, Math.cos((latitude * Math.PI) / 180));
  const lonSpan = Math.ceil(radiusKm / (DEG_LAT_KM * cosLat));

  const baseLat = Math.floor(latitude);
  const baseLon = Math.floor(longitude);
  const out: GeoCity[] = [];

  for (let dLat = -latSpan; dLat <= latSpan; dLat += 1) {
    for (let dLon = -lonSpan; dLon <= lonSpan; dLon += 1) {
      const bucket = grid.cells.get(cellKey(baseLat + dLat, wrapLongitudeCell(baseLon + dLon)));
      if (bucket) {
        out.push(...bucket);
      }
    }
  }

  return out;
}

function cellKey(latCell: number, lonCell: number): string {
  return `${latCell}:${lonCell}`;
}

// Antimeridian wrap so a query near ±180° still finds cities on the other side.
function wrapLongitudeCell(lonCell: number): number {
  if (lonCell < -180) {
    return lonCell + 360;
  }
  if (lonCell > 179) {
    return lonCell - 360;
  }
  return lonCell;
}

// ── Multi-airport metros ──────────────────────────────────────────────────────
//
// In big cities several airports serve one market (Moscow = SVO/DME/VKO/ZIA). If
// each airport independently claimed the full metro catchment, the city's market
// would be counted N times. We group member airports under a metro code; demand is
// computed once per metro pair, then split across members by capacity share.
//
// Keyed by IATA metropolitan code where one exists. Membership is by airport IATA.
// Everything not listed here is its own single-airport "metro" (handled by the
// caller). Curated list — extend as needed; covers the major multi-airport cities.
export const METRO_GROUPS: Record<string, string[]> = {
  BCN: ["BCN", "GRO", "REU"], // Barcelona (+ Girona/Reus, marketed as Barcelona)
  BFS: ["BFS", "BHD"], // Belfast
  BHZ: ["CNF", "PLU"], // Belo Horizonte
  BJS: ["PEK", "PKX", "NAY"], // Beijing
  BKK: ["BKK", "DMK"], // Bangkok
  BUE: ["EZE", "AEP"], // Buenos Aires
  CHI: ["ORD", "MDW", "RFD"], // Chicago
  CTU: ["CTU", "TFU"], // Chengdu
  DFW: ["DFW", "DAL"], // Dallas–Fort Worth
  HOU: ["IAH", "HOU"], // Houston
  IEV: ["KBP", "IEV"], // Kyiv
  IST: ["IST", "SAW"], // Istanbul
  JKT: ["CGK", "HLP"], // Jakarta
  KUL: ["KUL", "SZB"], // Kuala Lumpur
  LAX: ["LAX", "BUR", "LGB", "SNA", "ONT"], // Los Angeles
  LON: ["LHR", "LGW", "STN", "LTN", "LCY", "SEN"], // London
  MEL: ["MEL", "AVV"], // Melbourne
  MEX: ["MEX", "NLU", "TLC"], // Mexico City
  MIA: ["MIA", "FLL", "PBI"], // Miami / South Florida
  MIL: ["MXP", "LIN", "BGY"], // Milan
  MNL: ["MNL", "CRK"], // Manila (+ Clark, marketed as Manila)
  MOW: ["SVO", "DME", "VKO", "ZIA"], // Moscow
  NGO: ["NGO", "NKM"], // Nagoya
  NYC: ["JFK", "EWR", "LGA"], // New York
  OSA: ["KIX", "ITM", "UKB"], // Osaka
  OSL: ["OSL", "TRF", "RYG"], // Oslo (+ Torp/Rygge, marketed as Oslo)
  PAR: ["CDG", "ORY", "BVA"], // Paris
  RIO: ["GIG", "SDU"], // Rio de Janeiro
  ROM: ["FCO", "CIA"], // Rome
  SAO: ["GRU", "CGH", "VCP"], // São Paulo
  SEL: ["ICN", "GMP"], // Seoul
  SFO: ["SFO", "OAK", "SJC"], // San Francisco Bay Area
  SHA: ["PVG", "SHA"], // Shanghai
  STO: ["ARN", "BMA", "NYO"], // Stockholm
  TPE: ["TPE", "TSA"], // Taipei
  TYO: ["HND", "NRT"], // Tokyo
  WAS: ["IAD", "DCA", "BWI"], // Washington DC
  WAW: ["WAW", "WMI"], // Warsaw (+ Modlin)
  YMQ: ["YUL", "YMX"], // Montreal
  YTO: ["YYZ", "YTZ", "YHM"], // Toronto
};

// IATA code → metro code, derived from METRO_GROUPS.
export const METRO_BY_AIRPORT: Record<string, string> = Object.fromEntries(
  Object.entries(METRO_GROUPS).flatMap(([metro, members]) => members.map((iata) => [iata, metro])),
);

export function metroCodeForAirport(iataCode: string): string | undefined {
  return METRO_BY_AIRPORT[iataCode.toUpperCase()];
}

// ── Per-airport demand profiles ───────────────────────────────────────────────
//
// Joins catchment + metro grouping into the artifact the demand model consumes,
// using **competitive (Huff-style) allocation** so overlapping airports don't each
// claim the same population. Each city's population is split among the market nodes
// within range, proportional to accessibility (distance decay × capacity), plus an
// "outside option" so people far from every airport mostly don't fly. Without this,
// Cologne and Düsseldorf (~50 km apart) each claimed the whole Rhine-Ruhr, and tiny
// Paderborn claimed Bielefeld/Dortmund. A metro group is ONE competing node, then
// its catchment is split across member airports by capacity share.

// Share of a city that flies from nowhere modelled here (drives elsewhere / no
// trip). Larger → catchments shrink, especially for remote cities.
export const CATCHMENT_OUTSIDE_OPTION = 0.12;

export type AirportLite = {
  capacityIndex: number;
  iataCode: string;
  icaoCode: string;
  latitude: number;
  longitude: number;
};

export type AirportDemandProfile = {
  // Absolute airport strength (runway/type/scheduled-derived, ~0.03–1.8). Unlike
  // capacityShare (relative *within* a metro), this is the airport's standalone
  // pull, used by the demand model's route-viability factor so a tiny regional
  // field (FDH, NRN) doesn't capture trunk-route volumes. See airportStrengthFactor.
  capacityIndex: number;
  capacityShare: number;
  iataCode: string;
  icaoCode: string;
  // This airport's own slice of its market catchment (informational).
  localCatchmentPopulation: number;
  // The market this airport belongs to: a metro code or its own IATA code.
  marketKey: string;
  // Catchment of the whole market (shared by all member airports of a metro).
  marketCatchmentPopulation: number;
};

// A competing market: a metro group or a single airport, located at the capacity-
// weighted centroid of its members, with attractiveness = total member capacity.
type MarketNode = {
  attractiveness: number;
  catchment: number;
  key: string;
  latitude: number;
  longitude: number;
  members: AirportLite[];
};

export function buildAirportDemandProfiles(
  airports: AirportLite[],
  grid: CityGrid,
  options: CatchmentOptions = {},
): Map<string, AirportDemandProfile> {
  const radiusKm = options.radiusKm ?? CATCHMENT_RADIUS_KM;
  const decayRKm = options.decayRKm ?? CATCHMENT_DECAY_R_KM;

  const nodes = buildMarketNodes(airports);
  const nodeGrid = buildNodeGrid(nodes);
  allocateCityPopulation(nodeGrid, grid, radiusKm, decayRKm);

  const profiles = new Map<string, AirportDemandProfile>();
  for (const node of nodes) {
    const capacityTotal = node.members.reduce((sum, m) => sum + Math.max(0, m.capacityIndex), 0);
    const marketCatchment = Math.round(node.catchment);

    for (const member of node.members) {
      const share = capacityTotal > 0 ? Math.max(0, member.capacityIndex) / capacityTotal : 1 / node.members.length;
      profiles.set(member.icaoCode.toUpperCase(), {
        capacityIndex: member.capacityIndex,
        capacityShare: share,
        iataCode: member.iataCode.toUpperCase(),
        icaoCode: member.icaoCode.toUpperCase(),
        localCatchmentPopulation: Math.round(marketCatchment * share),
        marketCatchmentPopulation: marketCatchment,
        marketKey: node.key,
      });
    }
  }

  return profiles;
}

// Distributes every city's population across the market nodes within range using a
// Huff model: share_i = g_i / (G0 + Σ g_j), g = attractiveness · decay(distance).
function allocateCityPopulation(
  nodeGrid: Map<string, MarketNode[]>,
  cityGrid: CityGrid,
  radiusKm: number,
  decayRKm: number,
): void {
  for (const bucket of cityGrid.cells.values()) {
    for (const city of bucket) {
      const near = nearbyNodes(city.latitude, city.longitude, nodeGrid, radiusKm);
      const weights: Array<{ g: number; node: MarketNode }> = [];
      let denom = CATCHMENT_OUTSIDE_OPTION;

      for (const node of near) {
        const d = distanceKm(city.latitude, city.longitude, node.latitude, node.longitude);
        if (d > radiusKm) {
          continue;
        }
        const g = node.attractiveness / (1 + (d / decayRKm) ** 2);
        denom += g;
        weights.push({ g, node });
      }

      for (const { g, node } of weights) {
        node.catchment += (city.population * g) / denom;
      }
    }
  }
}

function buildMarketNodes(airports: AirportLite[]): MarketNode[] {
  const byMarket = new Map<string, AirportLite[]>();
  for (const airport of airports) {
    const marketKey = metroCodeForAirport(airport.iataCode) ?? airport.iataCode.toUpperCase();
    const bucket = byMarket.get(marketKey);
    if (bucket) {
      bucket.push(airport);
    } else {
      byMarket.set(marketKey, [airport]);
    }
  }

  return [...byMarket].map(([key, members]) => {
    const centroid = capacityWeightedCentroid(members);
    const attractiveness = Math.max(0.1, members.reduce((sum, m) => sum + Math.max(0, m.capacityIndex), 0));

    return { attractiveness, catchment: 0, key, latitude: centroid.latitude, longitude: centroid.longitude, members };
  });
}

function buildNodeGrid(nodes: MarketNode[]): Map<string, MarketNode[]> {
  const cells = new Map<string, MarketNode[]>();
  for (const node of nodes) {
    const key = cellKey(Math.floor(node.latitude), Math.floor(node.longitude));
    const bucket = cells.get(key);
    if (bucket) {
      bucket.push(node);
    } else {
      cells.set(key, [node]);
    }
  }
  return cells;
}

function capacityWeightedCentroid(airports: AirportLite[]): { latitude: number; longitude: number } {
  let weightTotal = 0;
  let latSum = 0;
  let lonSum = 0;
  for (const airport of airports) {
    const weight = Math.max(0.01, airport.capacityIndex);
    weightTotal += weight;
    latSum += airport.latitude * weight;
    lonSum += airport.longitude * weight;
  }
  if (weightTotal === 0) {
    return { latitude: airports[0]?.latitude ?? 0, longitude: airports[0]?.longitude ?? 0 };
  }
  return { latitude: latSum / weightTotal, longitude: lonSum / weightTotal };
}

function nearbyNodes(latitude: number, longitude: number, nodeGrid: Map<string, MarketNode[]>, radiusKm: number): MarketNode[] {
  const latSpan = Math.ceil(radiusKm / DEG_LAT_KM);
  const cosLat = Math.max(0.01, Math.cos((latitude * Math.PI) / 180));
  const lonSpan = Math.ceil(radiusKm / (DEG_LAT_KM * cosLat));
  const baseLat = Math.floor(latitude);
  const baseLon = Math.floor(longitude);
  const out: MarketNode[] = [];

  for (let dLat = -latSpan; dLat <= latSpan; dLat += 1) {
    for (let dLon = -lonSpan; dLon <= lonSpan; dLon += 1) {
      const bucket = nodeGrid.get(cellKey(baseLat + dLat, wrapLongitudeCell(baseLon + dLon)));
      if (bucket) {
        out.push(...bucket);
      }
    }
  }

  return out;
}
