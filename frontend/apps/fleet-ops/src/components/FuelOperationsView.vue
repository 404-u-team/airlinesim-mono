<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirAircraftThumb, AirButton, AirMetricCard, AirStatePanel } from "@airlinesim/air-ui";
import { getBackendBaseUrl } from "@airlinesim/game-sdk";
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { FleetOwnedAircraftCard, FuelPriceSnapshot } from "../types";

import { getFleetAircraft, getFuelHistory, getFuelPrice } from "../api";
import { formatMoneyValue, formatNumberValue } from "../formatters";
import FuelPriceChart from "./FuelPriceChart.vue";

const props = defineProps<{
  appLocale: Locale;
  t: (key: FleetMessageKey | string) => string;
}>();

const connectionState = ref<"connected" | "connecting" | "disconnected">("disconnected");
const current = ref<FuelPriceSnapshot | null>(null);
const error = ref("");
const history = ref<FuelPriceSnapshot[]>([]);
const ownedAircraft = ref<FleetOwnedAircraftCard[]>([]);
const isLoading = ref(false);

let ws: null | WebSocket = null;
let reconnectTimer: null | ReturnType<typeof setTimeout> = null;
let isClosedExplicitly = false;

const formattedRecordedAt = computed(() => current.value ? formatDateTime(current.value.recorded_at) : "-");
const liveLabel = computed(() => connectionState.value === "connected" ? props.t("fuel.live.connected") : props.t("fuel.live.disconnected"));
const trendLabel = computed(() => props.t(`fuel.trend.${lastDirection.value}`));

const lastDirection = computed(() => {
  const [latest, prev] = history.value;
  if (!latest || !prev || latest.price === prev.price) {
    return "stable";
  }
  return latest.price > prev.price ? "up" : "down";
});

const averagePrice = computed(() => history.value.length ? Math.round(history.value.reduce((sum, p) => sum + p.price, 0) / history.value.length) : 0);

const priceRange = computed(() => {
  if (!history.value.length) { return "-"; }
  const prices = history.value.map((p) => p.price);
  return `$${Math.min(...prices)} - $${Math.max(...prices)}`;
});

const fleetFuelImpact = computed(() => {
  if (!ownedAircraft.value.length || !current.value) { return []; }
  const groups = new Map<string, { count: number; fuelBurn: number; icaoCode?: string; imageUrl?: string; modelName: string; }>();
  for (const ac of ownedAircraft.value) {
    const model = ac.modelName || ac.type?.model_name || "Unknown";
    const existing = groups.get(model);
    if (existing) {
      existing.count++;
    } else {
      groups.set(model, { count: 1, fuelBurn: ac.type?.fuel_consumption_per_hour ?? 0, icaoCode: ac.type?.icao_code, imageUrl: ac.type?.image_url, modelName: model });
    }
  }
  const {price} = current.value;
  return Array.from(groups.values()).map((g) => ({
    costPerHour: (g.fuelBurn / 1000) * price,
    count: g.count,
    fuelBurn: g.fuelBurn,
    icaoCode: g.icaoCode,
    imageUrl: g.imageUrl,
    modelName: g.modelName,
  })).sort((a, b) => b.costPerHour - a.costPerHour);
});

onMounted(() => {
  void refresh();
  startRealtime();
});

onUnmounted(() => {
  stopRealtime();
});

const formatDateTime = (val: string) => new Intl.DateTimeFormat(props.appLocale, {
  day: "2-digit", hour: "2-digit", minute: "2-digit", month: "2-digit",
}).format(new Date(val));

function buildFuelSocketUrl(): string {
  const base = new URL(getBackendBaseUrl(), window.location.origin);
  base.protocol = base.protocol === "https:" ? "wss:" : "ws:";
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/fuel/ws`;
  return base.toString();
}

async function refresh(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    const [price, hist, fleet] = await Promise.all([
      getFuelPrice(),
      getFuelHistory(),
      getFleetAircraft().catch(() => ({ aircraft: [] })),
    ]);
    current.value = price;
    history.value = hist.history;
    ownedAircraft.value = fleet.aircraft;
  } catch (err) {
    error.value = err instanceof Error ? err.message : props.t("fuel.error");
  } finally {
    isLoading.value = false;
  }
}

function startRealtime(): void {
  if (ws) { return; }
  connectionState.value = "connecting";
  isClosedExplicitly = false;
  ws = new WebSocket(buildFuelSocketUrl());
  ws.addEventListener("open", () => { connectionState.value = "connected"; });
  ws.addEventListener("close", () => {
    connectionState.value = "disconnected";
    ws = null;
    if (!isClosedExplicitly) { reconnectTimer = setTimeout(startRealtime, 3000); }
  });
  ws.addEventListener("error", () => { connectionState.value = "disconnected"; });
  ws.addEventListener("message", (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as { price: number; recorded_at: string; type: string };
      if (payload.type === "fuel_price_changed") {
        const snapshot: FuelPriceSnapshot = {
          price: Number(payload.price),
          recorded_at: payload.recorded_at,
          source: "backend-realtime",
          unit_price: Number(payload.price),
          updated_at: new Date().toISOString(),
        };
        current.value = snapshot;
        history.value = [snapshot, ...history.value.filter((p) => p.recorded_at !== snapshot.recorded_at)].slice(0, 96);
      }
    } catch (e) {
      console.error("Failed to parse fuel WS message", e);
    }
  });
}

function stopRealtime(): void {
  isClosedExplicitly = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; }
}
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-3 text-body text-text-primary sm:p-4">
    <div class="mx-auto flex min-h-full max-w-[112rem] flex-col gap-4">
      <header class="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <h1 class="text-h2">
            {{ props.t("fuel.title") }}
          </h1>
          <p class="mt-1 max-w-3xl text-body text-text-muted">
            {{ props.t("fuel.subtitle") }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="rounded-full border px-3 py-1 text-caption font-medium shadow-sm transition-all"
            :class="connectionState === 'connected' ? 'border-success bg-success-bg text-success' : 'border-warning bg-warning-bg text-warning'"
          >
            {{ liveLabel }}
          </span>
          <AirButton
            :disabled="isLoading"
            :label="props.t('action.refresh')"
            size="sm"
            variant="primary-soft"
            @click="refresh"
          />
        </div>
      </header>

      <AirStatePanel
        v-if="error"
        :body="error"
        :title="props.t('fuel.error')"
        tone="danger"
      />

      <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AirMetricCard
          :label="props.t('fuel.metric.global')"
          :value="formatMoneyValue(props.appLocale, current?.price)"
        />
        <AirMetricCard
          :label="props.t('fuel.metric.trend')"
          :tone="lastDirection === 'up' ? 'warning' : lastDirection === 'down' ? 'success' : 'neutral'"
          :value="trendLabel"
        />
        <AirMetricCard
          :label="props.t('fuel.metric.average')"
          :value="formatMoneyValue(props.appLocale, averagePrice)"
        />
        <AirMetricCard
          :label="props.t('fuel.metric.range')"
          :value="priceRange"
        />
      </section>

      <!-- Main Section: Chart and History list -->
      <div class="grid gap-4 lg:grid-cols-3">
        <!-- Chart panel -->
        <section class="rounded-lg border border-border bg-surface p-4 shadow-sm lg:col-span-2">
          <div class="mb-4">
            <h2 class="text-subtitle font-bold text-text-primary">
              {{ props.t("fuel.chart.title") }}
            </h2>
            <p class="text-caption text-text-muted mt-0.5">
              {{ props.t("fuel.lastUpdate") }}: {{ formattedRecordedAt }}
            </p>
          </div>

          <div class="rounded-lg border border-border bg-background p-4">
            <FuelPriceChart
              v-if="history.length"
              :history="history"
              :locale="props.appLocale"
            />
            <p
              v-else
              class="py-16 text-center text-body text-text-muted"
            >
              {{ props.t("fuel.empty") }}
            </p>
          </div>
        </section>

        <!-- Recent price log -->
        <aside class="rounded-lg border border-border bg-surface p-4 shadow-sm lg:col-span-1">
          <div class="mb-3">
            <h2 class="text-subtitle font-bold text-text-primary">
              {{ props.t("fuel.history") }}
            </h2>
            <p class="text-caption text-text-muted mt-0.5">
              {{ props.t("fuel.history.subtitle") }}
            </p>
          </div>
          <div class="overflow-hidden rounded-lg border border-border">
            <table class="w-full border-collapse text-left">
              <thead>
                <tr class="border-b border-border bg-background text-caption font-bold text-text-muted uppercase tracking-wider">
                  <th class="px-3 py-2 text-left">
                    {{ props.t("fuel.table.time") }}
                  </th>
                  <th class="px-3 py-2 text-right">
                    {{ props.t("fuel.table.price") }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in history.slice(0, 8)"
                  :key="`${item.recorded_at}-${item.price}`"
                  class="border-b border-border hover:bg-surface-hover last:border-b-0"
                >
                  <td class="px-3 py-2 text-caption text-text-muted">
                    {{ formatDateTime(item.recorded_at) }}
                  </td>
                  <td class="px-3 py-2 text-right text-body font-semibold text-text-primary">
                    {{ formatMoneyValue(props.appLocale, item.price) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </aside>
      </div>

      <!-- Fleet Fuel cost impact analysis -->
      <section class="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <div class="mb-4">
          <h2 class="text-subtitle font-bold text-text-primary">
            {{ props.t("fuel.fleet.title") }}
          </h2>
          <p class="text-caption text-text-muted mt-0.5">
            {{ props.t("fuel.fleet.subtitle") }}
          </p>
        </div>

        <div v-if="!fleetFuelImpact.length" class="py-8 text-center border border-dashed border-border rounded-lg bg-background">
          <p class="text-body text-text-muted">
            {{ props.t("fuel.fleet.empty") }}
          </p>
        </div>

        <div v-else class="overflow-hidden rounded-lg border border-border">
          <table class="w-full border-collapse text-left">
            <thead>
              <tr class="border-b border-border bg-background text-caption font-bold text-text-muted uppercase tracking-wider">
                <th class="px-4 py-3 text-left">
                  {{ props.t("fuel.fleet.model") }}
                </th>
                <th class="px-4 py-3 text-center">
                  {{ props.t("fuel.fleet.count") }}
                </th>
                <th class="px-4 py-3 text-right">
                  {{ props.t("fuel.fleet.burn") }}
                </th>
                <th class="px-4 py-3 text-right">
                  {{ props.t("fuel.fleet.cost") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in fleetFuelImpact"
                :key="item.modelName"
                class="border-b border-border hover:bg-surface-hover last:border-b-0"
              >
                <td class="px-4 py-3 text-body font-medium text-text-primary">
                  <span class="flex min-w-0 items-center gap-3">
                    <AirAircraftThumb
                      :alt="item.modelName"
                      :fallback="item.icaoCode"
                      :image-url="item.imageUrl"
                      size="sm"
                    />
                    <span class="truncate">{{ item.modelName }}</span>
                  </span>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="inline-flex items-center rounded-full bg-surface border border-border px-2.5 py-0.5 text-caption font-semibold">
                    {{ item.count }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-body text-text-secondary">
                  {{ formatNumberValue(props.appLocale, item.fuelBurn) }} {{ props.t('unit.kgHour') }}
                </td>
                <td class="px-4 py-3 text-right text-body font-bold text-text-primary">
                  {{ formatMoneyValue(props.appLocale, item.costPerHour) }} / {{ props.t('unit.hourShort') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </section>
</template>
