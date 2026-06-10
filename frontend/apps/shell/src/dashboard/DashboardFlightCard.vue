<script setup lang="ts">
import { AirBadge } from "@airlinesim/air-ui";
import { type Locale } from "@airlinesim/i18n";
import { Fuel, Gauge, Mountain, Plane, Users, X } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import type { ShellMessageKey } from "../i18n/messages";
import type { DashboardFlightDetail, FlightDetailCard } from "./types";

const props = defineProps<{
  appLocale: Locale;
  detail: DashboardFlightDetail;
  t: (key: ShellMessageKey) => string;
}>();

const emit = defineEmits<{ close: [] }>();

// Local 1s tick so the progress bar, ETA and "departed ago" advance smoothly between
// the periodic detail re-fetches the dashboard performs (which refresh FL/speed/fuel).
const now = ref(Date.now());
let ticker: null | ReturnType<typeof setInterval> = null;

onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
});

const flight = computed<FlightDetailCard>(() => props.detail.flight);
const telemetry = computed(() => flight.value.telemetry);
const seats = computed(() => props.detail.aircraft?.seats ?? flight.value.expected.passengers);

const isAirborne = computed(() =>
  !["arrived", "boarding", "deplaning", "scheduled"].includes(telemetry.value.phase));
const isDone = computed(() => telemetry.value.phase === "arrived" || flight.value.status === "completed");

const progress = computed(() => {
  if (isDone.value) {
    return 100;
  }
  const departure = Date.parse(flight.value.departure_at);
  const arrival = Date.parse(flight.value.arrival_at);
  if (now.value < departure) {
    return 0;
  }

  return Math.max(0, Math.min(100, ((now.value - departure) / Math.max(arrival - departure, 1)) * 100));
});

const phaseLabel = computed(() => props.t(`flight.phase.${telemetry.value.phase}` as ShellMessageKey));

const statusBadge = computed<{ label: string; variant: "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" }>(() => {
  if (flight.value.status === "cancelled") {
    return { label: phaseLabel.value, variant: "danger-soft" };
  }
  if (isDone.value) {
    return { label: props.t("flight.phase.arrived"), variant: "success-soft" };
  }
  if (isAirborne.value) {
    return { label: props.t("flight.operatesNormally"), variant: "success-soft" };
  }
  if (telemetry.value.phase === "boarding") {
    return { label: phaseLabel.value, variant: "warning-soft" };
  }

  return { label: phaseLabel.value, variant: "primary-soft" };
});

const flightLevel = computed(() => isAirborne.value ? telemetry.value.cruise_flight_level : Math.round(telemetry.value.altitude_ft / 100));

const departedAgo = computed(() => formatDuration(now.value - Date.parse(flight.value.departure_at)));
const arrivalIn = computed(() => formatDuration(telemetry.value.eta_minutes * 60_000));

// Calendar-day delta (in UTC, the world clock the game runs on) between departure and
// arrival, so overnight and date-line legs surface a +1/-1 day marker on the arrival time.
const arrivalDayOffset = computed(() => {
  const departure = new Date(flight.value.departure_at);
  const arrival = new Date(flight.value.arrival_at);
  const departureDay = Date.UTC(departure.getUTCFullYear(), departure.getUTCMonth(), departure.getUTCDate());
  const arrivalDay = Date.UTC(arrival.getUTCFullYear(), arrival.getUTCMonth(), arrival.getUTCDate());

  return Math.round((arrivalDay - departureDay) / 86_400_000);
});

function airportCity(label: string): string {
  return label.includes(" - ") ? label.split(" - ").slice(1).join(" - ") : label;
}

function airportCode(airport: FlightDetailCard["origin_airport"]): string {
  return airport.iata_code ?? (airport.label.includes(" - ") ? airport.label.split(" - ")[0] ?? "----" : "----");
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatTime(value: string): string {
  // World clock is UTC (matches the shell header), so pin the formatter to UTC instead of
  // silently rendering the viewer's local timezone.
  return new Intl.DateTimeFormat(props.appLocale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value));
}
</script>

<template>
  <article class="flight-card flex w-full min-w-0 flex-col rounded-xl border border-border bg-surface shadow-lg">
    <header class="flex min-w-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div class="min-w-0">
        <p class="truncate text-h3 leading-tight">
          {{ flight.flight_number }}
        </p>
        <p
          v-if="detail.aircraft?.model_name"
          class="truncate text-caption text-text-muted"
        >
          {{ detail.aircraft.model_name }}<span v-if="detail.aircraft.tail_number"> · {{ detail.aircraft.tail_number }}</span>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <AirBadge
          :label="statusBadge.label"
          :variant="statusBadge.variant"
        />
        <button
          :aria-label="t('flight.close')"
          class="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
          type="button"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>
    </header>

    <div class="flex flex-col gap-4 px-4 py-3">
      <div class="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div class="min-w-0 text-left">
          <p class="text-h2 leading-none">
            {{ airportCode(flight.origin_airport) }}
          </p>
          <p class="mt-1 truncate text-caption text-text-muted">
            {{ airportCity(flight.origin_airport.label) }}
          </p>
        </div>
        <Plane
          class="shrink-0 rotate-90 justify-self-center text-primary"
          :size="20"
        />
        <div class="min-w-0 text-right">
          <p class="text-h2 leading-none">
            {{ airportCode(flight.destination_airport) }}
          </p>
          <p class="mt-1 truncate text-caption text-text-muted">
            {{ airportCity(flight.destination_airport.label) }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-caption text-text-muted">
        <div class="min-w-0">
          <p class="text-subtitle text-text-primary">
            {{ formatTime(flight.departure_at) }}
          </p>
          <span>{{ t("flight.actual") }}</span>
        </div>
        <span class="justify-self-center rounded bg-surface-subtle px-1.5 py-0.5 text-caption font-medium text-text-muted">
          {{ t("flight.timezone") }}
        </span>
        <div class="min-w-0 text-right">
          <p class="text-subtitle text-text-primary">
            {{ formatTime(flight.arrival_at)
            }}<sup
              v-if="arrivalDayOffset !== 0"
              class="ml-0.5 align-super text-caption font-semibold text-primary"
            >{{ arrivalDayOffset > 0 ? `+${arrivalDayOffset}` : arrivalDayOffset }}</sup>
          </p>
          <span>{{ t("flight.eta") }}</span>
        </div>
      </div>

      <dl class="grid grid-cols-2 gap-x-4 gap-y-3 text-body">
        <div class="flex min-w-0 items-center gap-2">
          <Plane
            class="shrink-0 text-text-muted"
            :size="16"
          />
          <span class="truncate">{{ phaseLabel }}</span>
        </div>
        <div class="flex min-w-0 items-center justify-end gap-2">
          <Mountain
            class="shrink-0 text-text-muted"
            :size="16"
          />
          <span>FL{{ flightLevel }}</span>
        </div>
        <div class="flex min-w-0 items-center gap-2">
          <Users
            class="shrink-0 text-text-muted"
            :size="16"
          />
          <span class="truncate">{{ telemetry.passengers_on_board }}/{{ seats }} {{ t("flight.seats") }}</span>
        </div>
        <div class="flex min-w-0 items-center justify-end gap-2">
          <Gauge
            class="shrink-0 text-text-muted"
            :size="16"
          />
          <span>{{ telemetry.ground_speed_kph }} km/h</span>
        </div>
        <div class="col-span-2 flex min-w-0 items-center gap-2">
          <Fuel
            class="shrink-0 text-text-muted"
            :size="16"
          />
          <span class="truncate">{{ telemetry.fuel_remaining_t }} t {{ t("flight.fuelRemaining") }}</span>
        </div>
      </dl>

      <div>
        <div class="relative h-2 overflow-hidden rounded-full bg-surface-subtle">
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <div class="mt-2 flex items-center justify-between gap-2 text-caption text-text-muted">
          <span class="truncate">{{ t("flight.departedAgo").replace("{time}", departedAgo) }}</span>
          <span class="shrink-0">{{ t("flight.arrivalIn").replace("{time}", arrivalIn) }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.flight-card {
  animation: flight-card-in 0.25s ease-out;
}

@keyframes flight-card-in {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
