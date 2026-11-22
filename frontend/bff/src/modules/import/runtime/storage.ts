import type { ImportMapping, ImportReport } from "../shared/types";
import { mkdir } from "node:fs/promises";

export { fetchCachedText } from "./source-fetch";

const DEFAULT_DATA_DIR = "data/import/world-data";

export type ImportPaths = {
  dataDir: string;
  manualDir: string;
  mappingPath: string;
  rawDir: string;
  reportsDir: string;
  stageDir: string;
};

export function getImportPaths(dataDir = DEFAULT_DATA_DIR): ImportPaths {
  return {
    dataDir,
    manualDir: `${dataDir}/manual`,
    mappingPath: `${dataDir}/mappings/source-mapping.json`,
    rawDir: `${dataDir}/raw`,
    reportsDir: `${dataDir}/reports`,
    stageDir: `${dataDir}/stage`,
  };
}

export async function ensureImportDirs(paths: ImportPaths): Promise<void> {
  await Promise.all([
    mkdir(paths.manualDir, { recursive: true }),
    mkdir(`${paths.dataDir}/mappings`, { recursive: true }),
    mkdir(paths.rawDir, { recursive: true }),
    mkdir(paths.reportsDir, { recursive: true }),
    mkdir(paths.stageDir, { recursive: true }),
  ]);
}

export async function readJsonFile<TValue>(path: string, fallback: TValue): Promise<TValue> {
  const text = await readTextIfExists(path);

  if (text == null) {
    return fallback;
  }

  return JSON.parse(text) as TValue;
}

export async function readMappings(path: string): Promise<Map<string, ImportMapping>> {
  const mappings = await readJsonFile<ImportMapping[]>(path, []);

  return new Map(mappings.map((mapping) => [mappingKey(mapping.entityType, mapping.sourceKey), mapping]));
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeMappings(
  path: string,
  mappings: Map<string, ImportMapping>,
): Promise<void> {
  await writeJsonFile(path, [...mappings.values()].sort(compareMappings));
}

export async function writeReport(paths: ImportPaths, report: ImportReport): Promise<string> {
  const stamp = report.startedAt.replaceAll(/[:.]/gu, "-");
  const path = `${paths.reportsDir}/world-data-${report.mode}-${stamp}.json`;
  report.reportPath = path;
  await writeJsonFile(path, report);

  return path;
}

export function mappingKey(entityType: string, sourceKey: string): string {
  return `${entityType}:${sourceKey}`;
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows = parseDelimited(text, ",");
  const headers = rows.shift() ?? [];

  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

export function parseTsv(text: string): string[][] {
  return parseDelimited(text, "\t");
}

function compareMappings(left: ImportMapping, right: ImportMapping): number {
  return `${left.entityType}:${left.sourceKey}`.localeCompare(`${right.entityType}:${right.sourceKey}`);
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";

    if (char === "\"") {
      const next = text[index + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
    } else {
      current += char;
    }
  }

  if (current !== "" || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

async function readTextIfExists(path: string): Promise<null | string> {
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  return await file.text();
}
