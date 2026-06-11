import { onBeforeUnmount, ref } from "vue";

import type { DashboardFlightDetail } from "./types";

import { getFlightDetail } from "./api";

// Owns the flight card opened from the dashboard map: fetches the detail on open and
// re-fetches the synthesized telemetry (FL/speed/fuel/phase) on an interval while open.
// The card itself ticks progress/ETA locally every second, so this only refreshes the
// slower-moving numbers.
const REFRESH_INTERVAL_MS = 8_000;

export function useFlightCard(): {
  closeFlight: () => void;
  openFlight: (flightId: string) => Promise<void>;
  selectedFlight: ReturnType<typeof ref<DashboardFlightDetail | null>>;
} {
  const selectedFlight = ref<DashboardFlightDetail | null>(null);
  let timer: null | ReturnType<typeof setInterval> = null;

  function closeFlight(): void {
    selectedFlight.value = null;
    stopRefresh();
  }

  async function openFlight(flightId: string): Promise<void> {
    try {
      selectedFlight.value = await getFlightDetail(flightId);
      stopRefresh();
      timer = setInterval(() => void refresh(flightId), REFRESH_INTERVAL_MS);
    } catch {
      closeFlight();
    }
  }

  async function refresh(flightId: string): Promise<void> {
    try {
      selectedFlight.value = await getFlightDetail(flightId);
    } catch {
      // Keep the last good snapshot if a refresh fails.
    }
  }

  function stopRefresh(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  onBeforeUnmount(stopRefresh);

  return { closeFlight, openFlight, selectedFlight };
}
