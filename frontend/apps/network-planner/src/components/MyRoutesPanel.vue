<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, ref } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type { StoredRoute } from "../types";

import { deleteRoute, getRoutes } from "../api";

const props = defineProps<{
  appLocale: Locale;
  t: (key: NetworkMessageKey) => string;
}>();

const PAGE_SIZE = 8;

const error = ref("");
const isLoading = ref(false);
const deletingId = ref("");
const page = ref(1);
const routes = ref<StoredRoute[]>([]);

const pageCount = computed(() => Math.max(1, Math.ceil(routes.value.length / PAGE_SIZE)));
const pagedRoutes = computed(() => routes.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "network-planner" });
  void load();
});

function airportCode(airport: StoredRoute["origin_airport"]): string {
  return airport?.iata_code || airport?.icao_code || airport?.id || "—";
}

function formatMoney(value: number | undefined): string {
  return new Intl.NumberFormat(props.appLocale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value ?? 0);
}

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat(props.appLocale, { maximumFractionDigits: 0 }).format(value ?? 0);
}

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const response = await getRoutes();
    routes.value = response.routes;
    if (page.value > pageCount.value) {
      page.value = pageCount.value;
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.load");
  } finally {
    isLoading.value = false;
  }
}

function openRoute(route: StoredRoute): void {
  airlineSimEventBus.emit("navigation:intent", {
    source: "mfe",
    targetPath: `/airports/my-routes/${encodeURIComponent(route.id)}`,
  });
}

async function removeRoute(route: StoredRoute): Promise<void> {
  // eslint-disable-next-line no-alert -- lightweight confirmation for a destructive action.
  if (deletingId.value || !globalThis.confirm(props.t("myRoutes.deleteConfirm"))) {
    return;
  }

  deletingId.value = route.id;
  error.value = "";

  try {
    await deleteRoute(route.id);
    routes.value = routes.value.filter((item) => item.id !== route.id);
    airlineSimEventBus.emit("game:snapshot-invalidated", { reason: "manual-refresh", source: "network-planner" });
    airlineSimEventBus.emit("map:network-refresh-requested", { reason: "manual-refresh", source: "network-planner" });
  } catch (deleteError) {
    error.value = deleteError instanceof Error ? deleteError.message : props.t("error.load");
  } finally {
    // eslint-disable-next-line require-atomic-updates -- single-flight busy flag, reset after the await settles.
    deletingId.value = "";
  }
}

function statusVariant(status: string): "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" {
  if (status === "active" || status === "scheduled") {
    return "success-soft";
  }
  if (status === "awaiting_schedule") {
    return "warning-soft";
  }
  if (status === "paused") {
    return "danger-soft";
  }
  return "primary-soft";
}
</script>

<template>
  <section class="my-routes-shell h-full overflow-y-auto bg-background p-3 text-body text-text-primary sm:p-4">
    <div class="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
      <div>
        <h1 class="text-h2">
          {{ t("myRoutes.title") }}
        </h1>
        <p class="mt-1 text-body text-text-muted">
          {{ t("myRoutes.subtitle") }}
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="isLoading ? '...' : t('action.refresh')"
        size="sm"
        variant="primary-soft"
        @click="load"
      />
    </div>

    <AirStatePanel
      v-if="error"
      :body="error"
      :title="t('error.load')"
      tone="danger"
    />
    <AirStatePanel
      v-else-if="!isLoading && routes.length === 0"
      :title="t('myRoutes.empty')"
      tone="info"
    />

    <ul
      v-else
      class="grid gap-2"
    >
      <li
        v-for="route in pagedRoutes"
        :key="route.id"
        class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition hover:border-primary"
        @click="openRoute(route)"
      >
        <div class="min-w-0">
          <p class="text-subtitle">
            {{ airportCode(route.origin_airport) }} → {{ airportCode(route.destination_airport) }}
          </p>
          <p class="mt-0.5 truncate text-caption text-text-muted">
            {{ route.origin_airport?.label }} — {{ route.destination_airport?.label }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-4 text-right">
          <div class="hidden sm:block">
            <p class="text-caption text-text-muted">
              {{ t("myRoutes.col.demand") }}
            </p>
            <p class="text-body">
              {{ formatNumber(Math.round((route.demand_snapshot.origin_daily_passengers + route.demand_snapshot.destination_daily_passengers) / 2)) }}
            </p>
          </div>
          <div class="hidden sm:block">
            <p class="text-caption text-text-muted">
              {{ t("myRoutes.col.profit") }}
            </p>
            <p
              class="text-body"
              :class="route.economics_snapshot.estimated_profit_per_flight > 0 ? 'text-success' : 'text-error'"
            >
              {{ formatMoney(route.economics_snapshot.estimated_profit_per_flight) }}
            </p>
          </div>
          <AirBadge
            :label="t(`status.${route.status}` as NetworkMessageKey) || route.status"
            :variant="statusVariant(route.status)"
          />
          <AirButton
            :disabled="deletingId === route.id"
            :label="deletingId === route.id ? '...' : t('myRoutes.delete')"
            size="sm"
            variant="danger-soft"
            @click.stop="removeRoute(route)"
          />
        </div>
      </li>
    </ul>

    <div
      v-if="routes.length > PAGE_SIZE"
      class="mt-3 flex items-center justify-center gap-3"
    >
      <AirButton
        :disabled="page <= 1"
        :label="t('pagination.prev')"
        size="sm"
        variant="primary-soft"
        @click="page = Math.max(1, page - 1)"
      />
      <span class="text-caption text-text-muted">{{ page }} / {{ pageCount }}</span>
      <AirButton
        :disabled="page >= pageCount"
        :label="t('pagination.next')"
        size="sm"
        variant="primary-soft"
        @click="page = Math.min(pageCount, page + 1)"
      />
    </div>
  </section>
</template>
