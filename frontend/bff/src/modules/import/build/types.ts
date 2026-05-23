import type { AirportRow, RawSources, RegionRow } from "../runtime/sources";
import type { FinalAirport, FinalCountry, FinalRegion, FinalRegionLink, SourceIssueSink } from "../shared/types";

export type AirportShell = Omit<FinalAirport, "payload"> & {
  row: AirportRow;
  runwayInfo: RunwayInfo;
};

export type BuildContext = {
  issues: SourceIssueSink;
  raw: RawSources;
};

export type CountryStats = {
  airportScoreMax: number;
  airportScoreMin: number;
  areaMax: number;
  areaMin: number;
  globalMedianGdp: number;
  populationMax: number;
  populationMin: number;
};

export type LinkCandidate = FinalRegionLink & {
  distanceKm: number;
  rawBusiness: number;
  rawDiaspora: number;
  rawTourism: number;
};

export type RegionDraft = {
  airportCapacitySum: number;
  centroid: FinalRegion["centroid"];
  country: FinalCountry;
  localCode: string;
  population: number;
  row: RegionRow;
};

export type RegionStats = {
  airportCapacityMax: number;
  airportCapacityMin: number;
  gdpPcMax: number;
  gdpPcMin: number;
  regionalGdpMax: number;
  regionalGdpMin: number;
  tourismArrivalsMax: number;
  tourismArrivalsMin: number;
};

export type RunwayInfo = {
  count: number;
  maxLengthM: number;
  worksAtNight: boolean;
};
