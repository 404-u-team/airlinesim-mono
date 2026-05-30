import type { FinalAircraftType, FinalAirport, FinalCountry, FinalRegion, FinalRegionLink, SourceIssueSink, WorldData } from "../shared/types";

const CONTINENTS = new Set(["AF", "AN", "AS", "EU", "NA", "OC", "SA"]);

export function validateWorldData(data: WorldData, issues: SourceIssueSink): boolean {
  const aircraftTypes = validateAircraftTypes(data.aircraftTypes, issues);
  const countries = validateCountries(data.countries, issues);
  const regions = validateRegions(data.regions, new Set(data.countries.map((country) => country.sourceKey)), issues);
  const airports = validateAirports(data.airports, countries, regions, issues);
  const links = validateRegionLinks(data.regionLinks, regions, issues);

  return aircraftTypes && countries.size > 0 && airports && links;
}

function validateAircraftTypes(aircraftTypes: FinalAircraftType[], issues: SourceIssueSink): boolean {
  const icaoCodes = new Set<string>();
  let ok = true;

  for (const aircraftType of aircraftTypes) {
    const { payload, sourceKey } = aircraftType;

    if (!/^[A-Z0-9]{3,4}$/u.test(payload.icao_code) || !/^[A-Z0-9]{2,3}$/u.test(payload.iata_code)) {
      ok = fail(issues, "aircraft-type", sourceKey, "Invalid aircraft type IATA or ICAO code");
    }
    if (icaoCodes.has(payload.icao_code)) {
      ok = fail(issues, "aircraft-type", sourceKey, "Duplicate aircraft type ICAO code");
    }
    if (!payload.model_name || !payload.characteristics) {
      ok = fail(issues, "aircraft-type", sourceKey, "Aircraft type model name or characteristics is empty");
    }
    if (payload.max_planned_seat_capacity < 20 || payload.max_range_km < 500 || payload.cruising_speed_kph < 250) {
      ok = fail(issues, "aircraft-type", sourceKey, "Aircraft type capacity, range or speed is out of range");
    }
    if (payload.min_runway_length_m < 500 || payload.mtow_kg < 5_000 || payload.fuel_consumption_per_hour <= 0) {
      ok = fail(issues, "aircraft-type", sourceKey, "Aircraft type runway, MTOW or fuel burn is out of range");
    }
    if (
      [
        payload.base_maintenance_points,
        payload.base_turnaround_points,
        payload.maint_cost_per_flight_hour,
        payload.maint_cost_per_landing,
        payload.maint_cost_per_takeoff,
        payload.price_per_unit,
        payload.production_points_price,
      ].some((value) => value <= 0)
    ) {
      ok = fail(issues, "aircraft-type", sourceKey, "Aircraft type cost or points field is not positive");
    }

    icaoCodes.add(payload.icao_code);
  }

  return ok;
}

function validateAirports(
  airports: FinalAirport[],
  countryKeys: Set<string>,
  regionKeys: Set<string>,
  issues: SourceIssueSink,
): boolean {
  const icaoCodes = new Set<string>();
  const iataCodes = new Set<string>();
  let ok = true;

  for (const airport of airports) {
    const { payload, sourceKey } = airport;

    if (!/^[A-Z0-9]{4}$/u.test(payload.icao_code)) {
      ok = fail(issues, "airport", sourceKey, "Invalid ICAO code");
    }
    if (!/^[A-Z0-9]{3}$/u.test(payload.iata_code)) {
      ok = fail(issues, "airport", sourceKey, "Invalid IATA code");
    }
    if (icaoCodes.has(payload.icao_code) || iataCodes.has(payload.iata_code)) {
      ok = fail(issues, "airport", sourceKey, "Duplicate ICAO or IATA code");
    }
    if (!payload.intl_name || !payload.local_name || !payload.timezone) {
      ok = fail(issues, "airport", sourceKey, "Airport name or timezone is empty");
    }
    if (!CONTINENTS.has(payload.continent)) {
      ok = fail(issues, "airport", sourceKey, "Invalid continent");
    }
    if (!Number.isFinite(payload.elevation_ft) || payload.max_runway_length_m < 1200 || payload.max_runway_uses_per_day < 20) {
      ok = fail(issues, "airport", sourceKey, "Invalid runway or elevation values");
    }
    if (payload.fuel_price_multiplier < 0.75 || payload.fuel_price_multiplier > 1.6) {
      ok = fail(issues, "airport", sourceKey, "Fuel price multiplier is out of range");
    }
    if ([payload.gate_fee, payload.maintenance_point_price, payload.runway_fee, payload.stand_fee, payload.turnaround_point_price].some((value) => value <= 0)) {
      ok = fail(issues, "airport", sourceKey, "Airport fee field is not positive");
    }
    if (!/^POINT\(-?\d+(\.\d+)? -?\d+(\.\d+)?\)$/u.test(payload.geog) || !/^POINT\(-?\d+(\.\d+)? -?\d+(\.\d+)?\)$/u.test(payload.geom)) {
      ok = fail(issues, "airport", sourceKey, "Invalid WKT point geometry");
    }
    if (!countryKeys.has(payload.country_id) || !regionKeys.has(payload.region_id)) {
      ok = fail(issues, "airport", sourceKey, "Referenced country or region does not exist in dataset");
    }

    icaoCodes.add(payload.icao_code);
    iataCodes.add(payload.iata_code);
  }

  return ok;
}

function validateCountries(countries: FinalCountry[], issues: SourceIssueSink): Set<string> {
  const keys = new Set<string>();
  const isos = new Set<string>();

  for (const country of countries) {
    const { payload } = country;

    if (!/^[A-Z]{2}$/u.test(payload.iso)) {
      fail(issues, "country", country.sourceKey, "Invalid ISO2 code");
    }
    if (!payload.intl_name || !payload.local_name) {
      fail(issues, "country", country.sourceKey, "Country names must be non-empty");
    }
    if (payload.corp_tax_rate < 0 || payload.corp_tax_rate > 60 || payload.vat_rate < 0 || payload.vat_rate > 35) {
      fail(issues, "country", country.sourceKey, "Country tax rate is out of range");
    }
    if (payload.flythrough_permission_price < 50 || payload.flythrough_permission_price > 2500 || payload.land_permission_price < 500 || payload.land_permission_price > 25000) {
      fail(issues, "country", country.sourceKey, "Permission price is out of range");
    }
    if (isos.has(payload.iso)) {
      fail(issues, "country", country.sourceKey, "Duplicate country ISO");
    }

    keys.add(country.sourceKey);
    isos.add(payload.iso);
  }

  return keys;
}

function validateRegionLinks(
  links: FinalRegionLink[],
  regionKeys: Set<string>,
  issues: SourceIssueSink,
): boolean {
  const pairs = new Set<string>();
  let ok = true;

  for (const link of links) {
    if (link.sourceRegionA === link.sourceRegionB) {
      ok = fail(issues, "region-link", link.sourceKey, "Self region link is not allowed");
    }
    if (!regionKeys.has(`region:${link.sourceRegionA}`) || !regionKeys.has(`region:${link.sourceRegionB}`)) {
      ok = fail(issues, "region-link", link.sourceKey, "Referenced region does not exist");
    }
    if (pairs.has(link.sourceKey)) {
      ok = fail(issues, "region-link", link.sourceKey, "Duplicate unordered region link");
    }
    if ([link.values.business, link.values.diaspora, link.values.tourism].some((value) => value < 0 || value > 1)) {
      ok = fail(issues, "region-link", link.sourceKey, "Link score is out of range");
    }

    pairs.add(link.sourceKey);
  }

  return ok;
}

function validateRegions(
  regions: FinalRegion[],
  countryKeys: Set<string>,
  issues: SourceIssueSink,
): Set<string> {
  const keys = new Set<string>();
  const localCodes = new Set<string>();

  for (const region of regions) {
    const { payload } = region;

    if (!payload.local_code.includes("-")) {
      fail(issues, "region", region.sourceKey, "Invalid local region code");
    }
    if (!countryKeys.has(payload.country_id)) {
      fail(issues, "region", region.sourceKey, "Referenced country does not exist in dataset");
    }
    if (payload.population < 1000 || payload.gdp_per_capita < 300) {
      fail(issues, "region", region.sourceKey, "Population or GDP per capita is out of range");
    }
    if (payload.business_score < 0 || payload.business_score > 1 || payload.tourism_score < 0 || payload.tourism_score > 1) {
      fail(issues, "region", region.sourceKey, "Region score is out of range");
    }
    if (localCodes.has(payload.local_code)) {
      fail(issues, "region", region.sourceKey, "Duplicate region local_code");
    }

    keys.add(region.sourceKey);
    localCodes.add(payload.local_code);
  }

  return keys;
}

function fail(issues: SourceIssueSink, entityType: string, sourceKey: string, message: string): false {
  issues.error(entityType, sourceKey, message);

  return false;
}
