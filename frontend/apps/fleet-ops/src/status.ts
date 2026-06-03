import type { FleetMarketAircraftType } from "./types";

export type StatusVariant = "danger-soft" | "primary-soft" | "success-soft" | "warning-soft";

const variants: Record<FleetMarketAircraftType["compatibility"]["status"], StatusVariant> = {
  available: "primary-soft",
  blocked: "danger-soft",
  recommended: "success-soft",
  risky: "warning-soft",
};

export function getStatusVariant(status: FleetMarketAircraftType["compatibility"]["status"]): StatusVariant {
  return variants[status];
}
