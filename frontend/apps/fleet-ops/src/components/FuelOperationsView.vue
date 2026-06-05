<script setup lang="ts">
import type { FuelPriceChangedEvent } from "@airlinesim/game-sdk/realtime";
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { createAuthClient, createRealtimeClient } from "@airlinesim/game-sdk";
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { FuelPriceSnapshot } from "../types";

import { getFuelHistory, getFuelPrice } from "../api";
import { formatMoneyValue, formatNumberValue } from "../formatters";

const props = defineProps<{
  appLocale: Locale;
  t: (key: FleetMessageKey | string) => string;
}>();

const authClient = createAuthClient();
const connectionState = ref<"connected" | "connecting" | "disconnected">("disconnected");
const current = ref<FuelPriceSnapshot | null>(null);
const error = ref("");
const history = ref<FuelPriceSnapshot[]>([]);
const isLoading = ref(false);
let socket: null | ReturnType<typeof createRealtimeClient> = null;

const formattedRecordedAt = computed(() =>
  current.value ? formatDateTime(current.value.recorded_at) : "-",
);
const lastDirection = computed(() => {
  const [latest, previous] = history.value;

  if (!latest || !previous) {
    return "stable";
  }
  if (latest.price > previous.price) {
    return "up";
  }
  if (latest.price < previous.price) {
    return "down";
  }

  return "stable";
});
const liveLabel = computed(() =>
  connectionState.value === "connected"
    ? props.t("fuel.live.connected")
    : props.t("fuel.live.disconnected"),
);
const sourceLabel = computed(() => {
  if (!current.value) {
    return "-";
  }

  return props.t(`fuel.source.${current.value.source}`);
});
const trendLabel = computed(() => props.t(`fuel.trend.${lastDirection.value}`));

onMounted(() => {
  void refresh();
  startRealtime();
});

onUnmounted(() => {
  socket?.disconnect();
  socket = null;
});

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(props.appLocale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: number | undefined): string {
  return formatMoneyValue(props.appLocale, value);
}

function formatNumber(value: number | undefined): string {
  return formatNumberValue(props.appLocale, value);
}

function normalizeFuelEvent(event: FuelPriceChangedEvent): FuelPriceSnapshot {
  const recordedAt = new Date(event.recorded_at);
  const recorded_at = Number.isNaN(recordedAt.getTime())
    ? new Date().toISOString()
    : recordedAt.toISOString();

  return {
    price: Number(event.price.toFixed(2)),
    recorded_at,
    source: "backend-realtime",
    unit_price: Number((event.price * 9.5).toFixed(2)),
    updated_at: new Date().toISOString(),
  };
}

async function refresh(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const [priceResponse, historyResponse] = await Promise.all([
      getFuelPrice(),
      getFuelHistory(),
    ]);
    current.value = priceResponse;
    history.value = historyResponse.history;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("fuel.error");
  } finally {
    isLoading.value = false;
  }
}

function startRealtime(): void {
  if (socket) {
    return;
  }

  connectionState.value = "connecting";
  socket = createRealtimeClient({ getToken: authClient.getAccessToken });
  socket.on("connect", () => {
    connectionState.value = "connected";
  });
  socket.on("disconnect", () => {
    connectionState.value = "disconnected";
  });
  socket.on("fuel_price_changed", (event: FuelPriceChangedEvent) => {
    const snapshot = normalizeFuelEvent(event);
    current.value = snapshot;
    history.value = [snapshot, ...history.value].slice(0, 96);
  });
}
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <header class="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <AirBadge
          label="Fleet & Ops"
          variant="primary-soft"
        />
        <h1 class="mt-4 text-h2">
          {{ props.t("fuel.title") }}
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          {{ props.t("fuel.subtitle") }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-full border px-3 py-1 text-caption"
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

    <div
      v-if="error"
      class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error"
    >
      {{ error }}
    </div>

    <div class="mt-5 grid gap-4 lg:grid-cols-4">
      <AirMetricCard
        :label="props.t('fuel.metric.global')"
        :value="formatNumber(current?.price)"
      />
      <AirMetricCard
        :label="props.t('fuel.metric.unit')"
        :value="formatMoney(current?.unit_price)"
      />
      <AirMetricCard
        :label="props.t('fuel.metric.trend')"
        :tone="lastDirection === 'up' ? 'warning' : lastDirection === 'down' ? 'success' : 'neutral'"
        :value="trendLabel"
      />
      <AirMetricCard
        :label="props.t('fuel.metric.source')"
        :value="sourceLabel"
      />
    </div>

    <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section class="rounded-lg border border-border bg-surface p-4">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-subtitle">
            {{ props.t("fuel.history") }}
          </h2>
          <span class="text-caption text-text-muted">{{ props.t("fuel.lastUpdate") }} {{ formattedRecordedAt }}</span>
        </div>

        <div class="mt-4 overflow-hidden rounded-lg border border-border">
          <table class="w-full table-fixed border-collapse text-left text-body">
            <thead class="bg-surface-subtle text-caption text-text-muted">
              <tr>
                <th class="px-3 py-2 font-medium">
                  {{ props.t("fuel.table.time") }}
                </th>
                <th class="px-3 py-2 text-right font-medium">
                  {{ props.t("fuel.table.global") }}
                </th>
                <th class="px-3 py-2 text-right font-medium">
                  {{ props.t("fuel.table.unit") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in history.slice(0, 12)"
                :key="`${item.recorded_at}-${item.price}`"
                class="border-t border-border"
              >
                <td class="truncate px-3 py-2 text-text-muted">
                  {{ formatDateTime(item.recorded_at) }}
                </td>
                <td class="px-3 py-2 text-right font-medium">
                  {{ formatNumber(item.price) }}
                </td>
                <td class="px-3 py-2 text-right font-medium">
                  {{ formatMoney(item.unit_price) }}
                </td>
              </tr>
              <tr v-if="history.length === 0">
                <td
                  class="px-3 py-8 text-center text-text-muted"
                  colspan="3"
                >
                  {{ props.t("fuel.empty") }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          {{ props.t("fuel.impact.title") }}
        </h2>
        <p class="mt-2 text-body text-text-muted">
          {{ props.t("fuel.impact.description") }}
        </p>
        <dl class="mt-4 space-y-3 text-body">
          <div class="flex items-center justify-between gap-4">
            <dt class="text-text-muted">
              {{ props.t("fuel.impact.routes") }}
            </dt>
            <dd class="text-right font-medium">
              {{ props.t("fuel.impact.live") }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-text-muted">
              {{ props.t("fuel.impact.schedules") }}
            </dt>
            <dd class="text-right font-medium">
              {{ props.t("fuel.impact.live") }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4">
            <dt class="text-text-muted">
              {{ props.t("fuel.impact.flights") }}
            </dt>
            <dd class="text-right font-medium">
              {{ props.t("fuel.impact.next") }}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>
</template>
