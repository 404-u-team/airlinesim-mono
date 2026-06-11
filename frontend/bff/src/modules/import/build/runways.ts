import type { RawSources } from "../runtime/sources";
import type { SourceIssueSink } from "../shared/types";
import type { RunwayInfo } from "./types";

import { clean, groupBy, parseNumber } from "./shared";

export function buildRunwayMap(raw: RawSources, issues: SourceIssueSink): Map<string, RunwayInfo> {
  const grouped = groupBy(raw.runways, (row) => clean(row.airport_ident));
  const result = new Map<string, RunwayInfo>();

  for (const [ident, rows] of grouped) {
    const valid = rows.flatMap((row) => {
      const lengthFt = parseNumber(row.length_ft);
      const surface = clean(row.surface).toUpperCase();

      if (clean(row.closed) === "1" || !lengthFt || lengthFt <= 0 || surface === "WATER") {
        return [];
      }

      return [{ lengthM: lengthFt * 0.3048, lighted: clean(row.lighted) === "1" }];
    });

    if (valid.length === 0) {
      issues.warn("airport", `airport:${ident}`, "No valid open runway records");
      continue;
    }

    result.set(ident, {
      count: valid.filter((row) => row.lengthM >= 1000).length,
      maxLengthM: Math.max(...valid.map((row) => row.lengthM)),
      worksAtNight: valid.some((row) => row.lighted),
    });
  }

  return result;
}
