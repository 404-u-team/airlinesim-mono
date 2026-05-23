import type { AirportRow } from "../runtime/sources";
import type { AirportPayload, AirportType, FinalAirport, FinalCountry, FinalRegion, SourceIssueSink } from "../shared/types";
import type { AirportShell, BuildContext, RunwayInfo } from "./types";

import { clamp, distanceKm, round2, roundTo, safeDiv } from "../shared/math";
import {
  airportCapacityIndex,
  clean,
  fallbackGdp,
  median,
  min,
  overrideFor,
  parseNumber,
  pickBoolean,
  pickNumber,
  pickString,
  runwayUses,
  validCoordinates,
} from "./shared";

const AIRPORT_TYPES = new Set(["large_airport", "medium_airport", "small_airport"]);

export function buildAirportShells(
  rows: AirportRow[],
  runways: Map<string, RunwayInfo>,
): AirportShell[] {
  return rows.map((row) => {
    const icao = firstNonEmptyCode(row).toUpperCase();
    const runwayInfo = runways.get(clean(row.ident)) ?? { count: 1, maxLengthM: 1200, worksAtNight: false };
    const type = clean(row.type) as AirportType;

    return {
      capacityIndex: airportCapacityIndex(type, runwayInfo, true, Boolean(clean(row.iata_code))),
      countryIso: clean(row.iso_country).toUpperCase(),
      latitude: Number(row.latitude_deg),
      longitude: Number(row.longitude_deg),
      regionCode: clean(row.iso_region).toUpperCase(),
      row,
      runwayInfo,
      sourceKey: `airport:${icao}`,
      type,
    };
  });
}

export function finalizeAirports(
  context: BuildContext,
  airportShells: AirportShell[],
  countries: FinalCountry[],
  regions: FinalRegion[],
): FinalAirport[] {
  const countryByIso = new Map(countries.map((country) => [country.iso, country]));
  const regionByCode = new Map(regions.map((region) => [region.localCode, region]));
  const medianGdp = median(countries.map((country) => country.gdpPerCapitaUsd ?? fallbackGdp(country.incomeLevelCode)));

  return airportShells.flatMap((airport) => {
    const country = countryByIso.get(airport.countryIso);
    const region = regionByCode.get(airport.regionCode);

    if (!country || !region) {
      context.issues.skip("airport", airport.sourceKey, "Referenced country or region was not selected");
      return [];
    }

    const override = overrideFor(context.raw.manual.airports, clean(airport.row.icao_code).toUpperCase(), airport.sourceKey);

    return [{ ...airport, payload: airportPayload(context, airport, country, region, medianGdp, airportShells, override) }];
  });
}

export function selectAirportRows(
  airports: AirportRow[],
  runways: Map<string, RunwayInfo>,
  issues: SourceIssueSink,
): AirportRow[] {
  return airports.filter((row) => isSelectedAirport(row, runways, issues));
}

function airportPayload(
  context: BuildContext,
  airport: AirportShell,
  country: FinalCountry,
  region: FinalRegion,
  medianGdp: number,
  airports: Array<Omit<FinalAirport, "payload">>,
  override: Record<string, unknown>,
): AirportPayload {
  const countryGdp = country.gdpPerCapitaUsd ?? fallbackGdp(country.incomeLevelCode);
  const wealthFactor = clamp(Math.sqrt(clamp(safeDiv(countryGdp, medianGdp, 1), 0.15, 5)), 0.4, 2.2);
  const runwayFactor = clamp(airport.runwayInfo.maxLengthM / 3500, 0.2, 1.35);
  const typeFeeFactor = airportTypeFeeFactor(airport.type);
  const importance = 0.75 + 0.25 * clamp(airport.capacityIndex, 0, 1.8);
  const gateFee = pickNumber(override, ["gate_fee", "gateFee"]) ?? clamp(roundTo(80 * wealthFactor * importance * typeFeeFactor, 10), 20, 1500);
  const wkt = `POINT(${airport.longitude.toFixed(6)} ${airport.latitude.toFixed(6)})`;

  return {
    continent: clean(airport.row.continent),
    country_id: country.sourceKey,
    elevation_ft: parseNumber(airport.row.elevation_ft) ?? 0,
    fuel_price_multiplier: pickNumber(override, ["fuel_price_multiplier", "fuelPriceMultiplier"]) ?? fuelMultiplier(country, airport, airports),
    gate_fee: gateFee,
    geog: wkt,
    geom: wkt,
    home_link: pickString(override, ["home_link", "homeLink"]) ?? clean(airport.row.home_link),
    iata_code: pickString(override, ["iata_code", "iataCode"]) ?? clean(airport.row.iata_code).toUpperCase(),
    icao_code: pickString(override, ["icao_code", "icaoCode"]) ?? firstNonEmptyCode(airport.row).toUpperCase(),
    intl_name: pickString(override, ["intl_name", "intlName"]) ?? clean(airport.row.name),
    local_name: pickString(override, ["local_name", "localName"]) ?? clean(airport.row.name),
    maintenance_point_price: pickNumber(override, ["maintenance_point_price", "maintenancePointPrice"]) ?? clamp(roundTo(90 * wealthFactor * clamp(1.25 - airport.capacityIndex * 0.18, 0.8, 1.35), 5), 25, 350),
    max_runway_length_m: pickNumber(override, ["max_runway_length_m", "maxRunwayLengthM"]) ?? Math.round(airport.runwayInfo.maxLengthM),
    max_runway_uses_per_day: pickNumber(override, ["max_runway_uses_per_day", "maxRunwayUsesPerDay"]) ?? runwayUses(airport.type, airport.runwayInfo),
    municipality: clean(airport.row.municipality),
    region_id: region.sourceKey,
    runway_fee: pickNumber(override, ["runway_fee", "runwayFee"]) ?? clamp(roundTo(120 * wealthFactor * importance * runwayFactor, 10), 30, 2000),
    stand_fee: pickNumber(override, ["stand_fee", "standFee"]) ?? clamp(roundTo(gateFee * 0.35, 10), 10, 600),
    timezone: pickString(override, ["timezone"]) ?? airportTimezone(context, airport),
    turnaround_point_price: pickNumber(override, ["turnaround_point_price", "turnaroundPointPrice"]) ?? clamp(roundTo(45 * wealthFactor * clamp(1.2 - airport.capacityIndex * 0.12, 0.85, 1.25), 5), 15, 200),
    wikipedia_link: pickString(override, ["wikipedia_link", "wikipediaLink"]) ?? clean(airport.row.wikipedia_link),
    works_at_night: pickBoolean(override, ["works_at_night", "worksAtNight"]) ?? airport.runwayInfo.worksAtNight,
  };
}

function airportTimezone(context: BuildContext, airport: Pick<AirportShell, "countryIso" | "latitude" | "longitude" | "sourceKey">): string {
  const nearest = context.raw.geoCities
    .filter((city) => city.countryCode === airport.countryIso && city.timezone)
    .map((city) => ({ city, distance: distanceKm(airport.latitude, airport.longitude, city.latitude, city.longitude) }))
    .sort((a, b) => a.distance - b.distance)[0];

  if (nearest) {
    return nearest.city.timezone;
  }

  context.issues.warn("airport", airport.sourceKey, "Using UTC timezone fallback");
  context.issues.reportQuality?.("airportsUsingUtcFallback");

  return "UTC";
}

function airportTypeFeeFactor(type: AirportType): number {
  const factorByType: Record<AirportType, number> = {
    large_airport: 1.35,
    medium_airport: 1,
    small_airport: 0.6,
  };

  return factorByType[type];
}

function fuelMultiplier(
  country: FinalCountry,
  airport: Omit<FinalAirport, "payload">,
  airports: Array<Omit<FinalAirport, "payload">>,
): number {
  const majors = airports.filter((candidate) => candidate !== airport && (candidate.type === "large_airport" || candidate.type === "medium_airport"));
  const nearest = min(majors.map((candidate) => distanceKm(airport.latitude, airport.longitude, candidate.latitude, candidate.longitude)), 3500);
  const isIslandish = !country.landlocked && country.borders.length === 0 && (country.areaKm2 ?? 0) < 1_000_000;
  const remotePenalty = clamp((nearest / 3500) * 0.2, 0, 0.2);
  const islandPenalty = isIslandish ? 0.08 : 0;
  const hubDiscount = airport.type === "large_airport" && airport.capacityIndex > 1 ? -0.08 : 0;
  const fuelTax = clamp(((country.payload.vat_rate || 15) - 15) / 100 * 0.2, -0.03, 0.08);

  return clamp(round2(1 + remotePenalty + islandPenalty + fuelTax + hubDiscount), 0.75, 1.6);
}

function isSelectedAirport(row: AirportRow, runways: Map<string, RunwayInfo>, issues: SourceIssueSink): boolean {
  const ident = clean(row.ident);
  const type = clean(row.type);
  const icao = firstNonEmptyCode(row).toUpperCase();
  const iata = clean(row.iata_code).toUpperCase();
  const runway = runways.get(ident);

  if (!AIRPORT_TYPES.has(type) || clean(row.scheduled_service).toLowerCase() !== "yes") {
    return skipAirport(issues, icao, ident, "Airport does not match MVP type/scheduled-service filter");
  }
  if (!/^[A-Z0-9]{4}$/u.test(icao) || !/^[A-Z0-9]{3}$/u.test(iata)) {
    return skipAirport(issues, icao, ident, "Airport has invalid ICAO or IATA code");
  }
  if (!validCoordinates(Number(row.latitude_deg), Number(row.longitude_deg))) {
    return skipAirport(issues, icao, ident, "Airport has invalid coordinates");
  }
  if (!/^[A-Z]{2}$/u.test(clean(row.iso_country).toUpperCase()) || !clean(row.iso_region)) {
    return skipAirport(issues, icao, ident, "Airport has invalid country or region reference");
  }
  if (!runway || runway.maxLengthM < 1200 || (type === "small_airport" && runway.maxLengthM < 1500)) {
    return skipAirport(issues, icao, ident, "Airport has no qualifying runway data");
  }

  return true;
}

function skipAirport(issues: SourceIssueSink, icao: string, ident: string, reason: string): false {
  issues.skip("airport", `airport:${icao || ident}`, reason);

  return false;
}

function firstNonEmptyCode(row: AirportRow): string {
  return clean(row.icao_code) || clean(row.gps_code) || clean(row.ident);
}
