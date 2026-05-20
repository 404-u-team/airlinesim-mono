import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const defaultDevPortBase = 4100;

export const appPortOffsets = {
  eventsNews: 5,
  financeStock: 3,
  fleetOps: 2,
  hrFacilities: 6,
  map: 1,
  networkPlanner: 4,
  shell: 0,
} as const;

export type AppPortId = keyof typeof appPortOffsets;

export type AppPorts = Record<AppPortId, number>;

export const toolDevPorts = {
  storybook: 6006,
} as const;

export function getAppDevPorts(rootDir = process.cwd()): AppPorts {
  const basePort = getDevPortBase(rootDir);

  return Object.fromEntries(
    Object.entries(appPortOffsets).map(([appId, offset]) => [appId, basePort + offset]),
  ) as AppPorts;
}

export function getDevAppPortRange(rootDir = process.cwd()): number[] {
  const ports = getAppDevPorts(rootDir);

  return Object.values(ports).sort((left, right) => left - right);
}

export function getFrontendDevPorts(rootDir = process.cwd()): number[] {
  return [...new Set([...getDevAppPortRange(rootDir), ...Object.values(toolDevPorts)])].sort(
    (left, right) => left - right,
  );
}

export function getDevPortBase(rootDir = process.cwd()): number {
  const envValue = process.env.VITE_DEV_PORT_BASE ?? readEnvValue(rootDir, "VITE_DEV_PORT_BASE");
  const port = envValue ? Number.parseInt(envValue, 10) : defaultDevPortBase;

  if (!Number.isInteger(port) || port <= 0 || port + maxOffset() > 65_535) {
    throw new Error(
      `VITE_DEV_PORT_BASE must be an integer between 1 and ${65_535 - maxOffset()}.`,
    );
  }

  return port;
}

function maxOffset(): number {
  return Math.max(...Object.values(appPortOffsets));
}

function readEnvValue(rootDir: string, key: string): string | undefined {
  const envPath = resolve(rootDir, ".env");

  if (!existsSync(envPath)) {
    return undefined;
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  return line?.slice(line.indexOf("=") + 1).trim();
}
