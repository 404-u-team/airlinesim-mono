import type { BuildOptions, SourceIssueSink, WorldData } from "../shared/types";

import { buildAirportShells, finalizeAirports, selectAirportRows } from "./airports";
import { buildAircraftTypes } from "./aircraftTypes";
import { buildCountries } from "./countries";
import { buildRegionLinks } from "./regionLinks";
import { buildRegions } from "./regions";
import { buildRunwayMap } from "./runways";
import { clean } from "./shared";
import { loadRawSources } from "../runtime/sources";

export async function buildWorldData(options: BuildOptions, issues: SourceIssueSink): Promise<WorldData> {
  const raw = await loadRawSources(options);
  const context = { issues, raw };
  const aircraftTypes = buildAircraftTypes(issues, raw.manual.aircraftTypes);
  const runways = buildRunwayMap(raw, issues);
  const selectedRows = selectAirportRows(raw.airports, runways, issues);
  const selectedCountries = new Set(selectedRows.map((row) => clean(row.iso_country).toUpperCase()));
  const selectedRegions = new Set(selectedRows.map((row) => clean(row.iso_region).toUpperCase()));
  const countries = buildCountries(context, selectedCountries, selectedRows);
  const airportShells = buildAirportShells(selectedRows, runways);
  const regions = buildRegions(context, selectedRegions, airportShells, countries);
  const airports = finalizeAirports(context, airportShells, countries, regions);
  const regionLinks = buildRegionLinks(context, countries, regions);

  return { aircraftTypes, airports, countries, regionLinks, regions };
}
