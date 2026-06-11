import { expect, test } from "bun:test";

import type { ImportReport } from "../src/modules/import/shared/types";

import { progressCounts } from "../src/modules/import/runtime/progress";

test("import progress exposes live issue totals alongside pipeline counts", () => {
  const report: ImportReport = {
    counts: { countries: 3, countriesToCreate: 2, errors: 0, invalidSkipped: 0, warnings: 0 },
    errors: [{ entityType: "country", message: "Invalid country", sourceKey: "country:XX" }],
    finishedAt: "",
    mode: "dry-run",
    quality: {},
    skipped: [{ entityType: "airport", message: "Missing runway", sourceKey: "airport:TEST" }],
    startedAt: "2026-06-04T00:00:00.000Z",
    warnings: [{ entityType: "region", message: "Fallback population", sourceKey: "region:XX-1" }],
  };

  expect(progressCounts(report)).toMatchObject({
    countries: 3,
    countriesToCreate: 2,
    errors: 1,
    invalidSkipped: 1,
    warnings: 1,
  });
});
