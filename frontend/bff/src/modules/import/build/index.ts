import type { BuildOptions, SourceIssueSink, WorldData } from "../shared/types";
import type { ImportLogger } from "../runtime/logger";

import { buildAirportShells, finalizeAirports, selectAirportRows } from "./airports";
import { buildAircraftTypes } from "./aircraftTypes";
import { buildAirportDemandProfiles, buildCityGrid } from "./catchment";
import { buildCountries } from "./countries";
import { buildRegions } from "./regions";
import { buildRunwayMap } from "./runways";
import { clean } from "./shared";
import { loadRawSources } from "../runtime/sources";

export async function buildWorldData(options: BuildOptions, issues: SourceIssueSink, log?: ImportLogger): Promise<WorldData> {
  const raw = await loadRawSources(options, log);
  const context = { issues, raw };
  const aircraftTypes = await buildAircraftTypes(issues, raw.manual.aircraftTypes, raw, options);
  const runways = buildRunwayMap(raw, issues);
  const selectedRows = selectAirportRows(raw.airports, runways, issues);
  const selectedCountries = new Set(selectedRows.map((row) => clean(row.iso_country).toUpperCase()));
  const selectedRegions = new Set(selectedRows.map((row) => clean(row.iso_region).toUpperCase()));
  const countries = buildCountries(context, selectedCountries, selectedRows);
  const airportShells = buildAirportShells(selectedRows, runways);
  const regions = buildRegions(context, selectedRegions, airportShells, countries);
  const airports = finalizeAirports(context, airportShells, countries, regions);

  // Layer 0 demand profiles: catchment population + metro market + capacity share
  // per airport, computed from GeoNames cities. Written to a separate stage
  // artifact and consumed by the demand model. See docs/passenger-demand-model.md.
  const cityGrid = buildCityGrid(raw.geoCities);
  const airportDemandProfiles = [
    ...buildAirportDemandProfiles(
      airports.map((airport) => ({
        capacityIndex: airport.capacityIndex,
        iataCode: airport.payload.iata_code,
        icaoCode: airport.payload.icao_code,
        latitude: airport.latitude,
        longitude: airport.longitude,
      })),
      cityGrid,
    ).values(),
  ];

  return { aircraftTypes, airportDemandProfiles, airports, countries, regionLinks: [], regions };
}
