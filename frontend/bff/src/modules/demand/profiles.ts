import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { AirportDemandProfile } from "../import/build/catchment";

// Loads the per-airport demand profile artifact produced by the import pipeline
// (catchment population + metro market + capacity share), keyed by ICAO code. The
// demand service joins it to runtime airports (from the backend) by icao_code.
//
// The artifact lives in the import stage dir. If it is missing (e.g. before the
// first import has run), lookups return undefined and the demand service falls
// back to admin1 region population — so the app keeps working pre-import.
// See docs/passenger-demand-model.md "Слой 0".

export const AIRPORT_DEMAND_PROFILE_FILE = "airport-demand-profile.latest.json";

const ARTIFACT_PATH =
  process.env.BFF_AIRPORT_DEMAND_PROFILE_PATH ??
  resolve(import.meta.dir, "../../../data/import/world-data/stage", AIRPORT_DEMAND_PROFILE_FILE);

let cache: Map<string, AirportDemandProfile> | null = null;

export function getAirportProfile(icaoCode: string | undefined): AirportDemandProfile | undefined {
  if (!icaoCode) {
    return undefined;
  }
  return loadProfiles().get(icaoCode.toUpperCase());
}

export function hasAirportProfiles(): boolean {
  return loadProfiles().size > 0;
}

// Test seam: replace the in-memory profile map.
export function setAirportProfilesForTesting(profiles: Map<string, AirportDemandProfile> | null): void {
  cache = profiles;
}

function loadProfiles(): Map<string, AirportDemandProfile> {
  if (cache) {
    return cache;
  }

  cache = new Map();
  if (!existsSync(ARTIFACT_PATH)) {
    return cache;
  }

  try {
    const parsed = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as { profiles?: AirportDemandProfile[] };
    for (const profile of parsed.profiles ?? []) {
      if (profile.icaoCode) {
        cache.set(profile.icaoCode.toUpperCase(), profile);
      }
    }
  } catch (error) {
    console.warn("BFF could not read airport demand profiles:", error);
  }

  return cache;
}
