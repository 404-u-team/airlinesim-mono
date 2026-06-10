<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { FlightDetail, FlightDetailResponse } from "../types";

import { getFlightDetail } from "../api";
import { formatMoneyValue, formatNumberValue } from "../formatters";

const props = defineProps<{
  appLocale: Locale;
  flightId: string;
  t: (key: FleetMessageKey | string) => string;
}>();

const detail = ref<FlightDetailResponse | null>(null);
const error = ref("");
const isLoading = ref(false);
const now = ref(Date.now());
let ticker: null | ReturnType<typeof setInterval> = null;
let refresh: null | ReturnType<typeof setInterval> = null;

onMounted(() => {
  void load();
  ticker = setInterval(() => {
    now.value = Date.now();
  }, 1000);
  // Re-pull synthesized telemetry (FL/speed/fuel/phase) periodically while open.
  refresh = setInterval(() => void load(), 8000);
});

onBeforeUnmount(() => {
  clearTimer(ticker);
  clearTimer(refresh);
});

watch(() => props.flightId, () => void load());

const flight = computed<FlightDetail | null>(() => detail.value?.flight ?? null);
const telemetry = computed(() => flight.value?.telemetry ?? null);
const seats = computed(() => detail.value?.aircraft?.seats ?? flight.value?.expected.passengers ?? 0);
const result = computed(() => flight.value?.actual ?? flight.value?.expected ?? null);
const isActual = computed(() => Boolean(flight.value?.actual));

const isAirborne = computed(() =>
  Boolean(telemetry.value) && !["arrived", "boarding", "deplaning", "scheduled"].includes(telemetry.value?.phase ?? ""));
const isDone = computed(() => telemetry.value?.phase === "arrived" || flight.value?.status === "completed");

const progress = computed(() => {
  if (!flight.value) {
    return 0;
  }
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

const phaseLabel = computed(() => telemetry.value ? props.t(`flight.phase.${telemetry.value.phase}`) : "");
const flightLevel = computed(() => {
  if (!telemetry.value) {
    return 0;
  }

  return isAirborne.value ? telemetry.value.cruise_flight_level : Math.round(telemetry.value.altitude_ft / 100);
});

const statusBadge = computed<{ label: string; variant: "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" }>(() => {
  if (flight.value?.status === "cancelled") {
    return { label: props.t("flight.status.cancelled"), variant: "danger-soft" };
  }
  if (isDone.value) {
    return { label: props.t("flight.phase.arrived"), variant: "success-soft" };
  }
  if (isAirborne.value) {
    return { label: props.t("flight.operatesNormally"), variant: "success-soft" };
  }
  if (telemetry.value?.phase === "boarding") {
    return { label: phaseLabel.value, variant: "warning-soft" };
  }

  return { label: phaseLabel.value || props.t("flight.status.scheduled"), variant: "primary-soft" };
});

function airportCity(label: string): string {
  return label.includes(" - ") ? label.split(" - ").slice(1).join(" - ") : label;
}

function airportCode(label: string, fallback?: string): string {
  return label.includes(" - ") ? label.split(" - ")[0] ?? fallback ?? "----" : fallback ?? label;
}

function back(): void {
  airlineSimEventBus.emit("navigation:intent", { source: "mfe", targetPath: "/operations/live-flights" });
}

function clearTimer(timer: null | ReturnType<typeof setInterval>): void {
  if (timer !== null) {
    clearInterval(timer);
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(props.appLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));

  return `${Math.floor(totalMinutes / 60)}${props.t("unit.hourShort")} ${totalMinutes % 60}${props.t("unit.minuteShort")}`;
}

function formatMoney(value: number | undefined): string {
  return formatMoneyValue(props.appLocale, value);
}

function formatNumber(value: number | undefined): string {
  return formatNumberValue(props.appLocale, value);
}

async function load(): Promise<void> {
  if (!props.flightId) {
    return;
  }
  isLoading.value = true;

  try {
    detail.value = await getFlightDetail(props.flightId);
    error.value = "";
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("flight.detail.notFound");
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-3 text-body text-text-primary sm:p-4">
    <div class="mx-auto flex min-h-full max-w-[72rem] flex-col gap-4">
      <AirButton
        class="self-start"
        :label="`← ${t('flight.detail.back')}`"
        size="sm"
        variant="primary-soft"
        @click="back"
      />

      <AirStatePanel
        v-if="error"
        :body="error"
        :title="t('flight.detail.notFound')"
        tone="danger"
      />

      <template v-else-if="flight && telemetry && result">
        <header class="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="min-w-0">
            <h1 class="text-h2">
              {{ flight.flight_number }}
            </h1>
            <p class="mt-1 text-body text-text-muted">
              {{ t("flight.detail.subtitle") }}
            </p>
          </div>
          <AirBadge
            :label="statusBadge.label"
            :variant="statusBadge.variant"
          />
        </header>

        <section class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div class="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-4">
            <div class="flex min-w-0 items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-h2 leading-none">
                  {{ airportCode(flight.origin_airport?.label ?? '', flight.origin_airport_id) }}
                </p>
                <p class="mt-1 truncate text-caption text-text-muted">
                  {{ airportCity(flight.origin_airport?.label ?? flight.origin_airport_id) }}
                </p>
              </div>
              <span
                aria-hidden="true"
                class="shrink-0 px-2 text-h3 text-primary"
              >→</span>
              <div class="min-w-0 text-right">
                <p class="text-h2 leading-none">
                  {{ airportCode(flight.destination_airport?.label ?? '', flight.destination_airport_id) }}
                </p>
                <p class="mt-1 truncate text-caption text-text-muted">
                  {{ airportCity(flight.destination_airport?.label ?? flight.destination_airport_id) }}
                </p>
              </div>
            </div>

            <div class="h-2 overflow-hidden rounded-full bg-surface-subtle">
              <div
                class="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                :style="{ width: `${progress}%` }"
              />
            </div>
            <div class="flex items-center justify-between gap-2 text-caption text-text-muted">
              <span>{{ formatDate(flight.departure_at) }}</span>
              <span>{{ formatDate(flight.arrival_at) }}</span>
            </div>

            <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <AirMetricCard
                :label="t('flight.detail.altitude')"
                :value="`FL${flightLevel}`"
              />
              <AirMetricCard
                :label="t('flight.detail.speed')"
                :value="`${formatNumber(telemetry.ground_speed_kph)} ${t('unit.kph')}`"
              />
              <AirMetricCard
                :label="t('flight.detail.eta')"
                :value="formatDuration(telemetry.eta_minutes * 60_000)"
              />
              <AirMetricCard
                :label="t('flight.detail.onBoard')"
                :value="`${formatNumber(telemetry.passengers_on_board)} / ${formatNumber(seats)}`"
              />
              <AirMetricCard
                :label="t('flight.detail.fuelRemaining')"
                :value="`${formatNumber(telemetry.fuel_remaining_t)} t`"
              />
              <AirMetricCard
                :label="t('flight.detail.loadFactor')"
                :value="`${Math.round(result.load_factor * 100)}%`"
              />
            </dl>
          </div>

          <aside class="grid min-w-0 content-start gap-4">
            <div class="rounded-lg border border-border bg-surface p-4">
              <h2 class="text-subtitle">
                {{ isActual ? t("flight.detail.actualResult") : t("flight.detail.expectedResult") }}
              </h2>
              <dl class="mt-3 grid gap-2 text-body">
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-text-muted">
                    {{ t("flight.detail.passengers") }}
                  </dt>
                  <dd>{{ formatNumber(result.passengers) }} / {{ formatNumber(seats) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-text-muted">
                    {{ t("flight.detail.revenue") }}
                  </dt>
                  <dd>{{ formatMoney(result.revenue) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <dt class="text-text-muted">
                    {{ t("flight.detail.cost") }}
                  </dt>
                  <dd>{{ formatMoney(result.cost) }}</dd>
                </div>
                <div class="flex items-center justify-between gap-2 border-t border-border pt-2">
                  <dt class="text-text-muted">
                    {{ t("flight.detail.profit") }}
                  </dt>
                  <dd :class="result.profit >= 0 ? 'text-success' : 'text-error'">
                    {{ formatMoney(result.profit) }}
                  </dd>
                </div>
              </dl>
            </div>

            <div
              v-if="detail?.aircraft"
              class="rounded-lg border border-border bg-surface p-4"
            >
              <h2 class="text-subtitle">
                {{ t("flight.detail.aircraft") }}
              </h2>
              <p class="mt-2 text-body">
                {{ detail.aircraft.model_name ?? detail.aircraft.id }}
              </p>
              <p
                v-if="detail.aircraft.tail_number"
                class="text-caption text-text-muted"
              >
                {{ detail.aircraft.tail_number }}
              </p>
            </div>
          </aside>
        </section>
      </template>
    </div>
  </section>
</template>
