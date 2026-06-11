import type { ImportMode } from "./shared/types";

import { getConfig } from "../../config";
import { runWorldDataImport } from "./runtime/pipeline";

const args = new Set(Bun.argv.slice(2));
const mode: ImportMode = args.has("--import") ? "import" : "dry-run";
const refreshRaw = args.has("--refresh-raw") || args.has("--fetch");
const source = args.has("--fetch") ? "fetch" : undefined;

const result = await runWorldDataImport(getConfig(), {
  mode,
  refreshRaw,
  source,
});

console.warn(JSON.stringify({
  counts: result.report.counts,
  finishedAt: result.report.finishedAt,
  quality: result.report.quality,
  reportPath: result.report.reportPath,
}, null, 2));
