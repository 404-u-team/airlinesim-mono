<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { type Locale, translate } from "@airlinesim/i18n";
import { AlertTriangle, Building2, MapPin, Plane, Route, WifiOff } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import type { DashboardMapState, DashboardSummary } from "./types";

import MapControls from "../components/MapControls.vue";
import SvelteWrapper from "../components/SvelteWrapper.vue";
import { type ShellMessageKey, shellMessages } from "../i18n/messages";
import { getDashboardMapState, getDashboardSummary } from "./api";
import DashboardAlerts from "./DashboardAlerts.vue";
import DashboardMetricStrip from "./DashboardMetricStrip.vue";
import DashboardNextAction from "./DashboardNextAction.vue";
import DashboardProgressNav from "./DashboardProgressNav.vue";
import { setDashboardSummary } from "./state";

const props = defineProps<{
  appLocale: Locale;
  appTheme: "dark" | "light";
}>();

const router = useRouter();
const error = ref("");
const isLoading = ref(true);
const isRefreshing = ref(false);
const mapState = ref<DashboardMapState | null>(null);
const selectedAirportId = ref<string | undefined>();
const summary = ref<DashboardSummary | null>(null);

let unsubscribeAirportSelected: (() => void) | null = null;

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);
const selectedAirport = computed(() => mapState.value?.selected ?? null);

const createMap = async (
  target: HTMLElement,
  componentProps: Record<string, unknown>,
): Promise<ReturnType<typeof import("map/Map")["createMap"]>> => {
  const remote = await import("map/Map");

  return remote.createMap(target, componentProps);
};

onMounted(() => {
  void loadDashboard();
  unsubscribeAirportSelected = airlineSimEventBus.on("map:airport-selected", (event) => {
    selectedAirportId.value = event.airportId;
    void loadMapState(event.airportId);
  });
});

onBeforeUnmount(() => {
  unsubscribeAirportSelected?.();
  unsubscribeAirportSelected = null;
});

function formatMoney(value: number): string {
  return new Intl.NumberFormat(props.appLocale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat(props.appLocale, { maximumFractionDigits: 0 }).format(value ?? 0);
}

async function loadDashboard(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const [summaryResponse, mapResponse] = await Promise.all([
      getDashboardSummary(),
      getDashboardMapState(selectedAirportId.value),
    ]);
    summary.value = summaryResponse;
    mapState.value = mapResponse;
    setDashboardSummary(summaryResponse);
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : t.value("dashboard.error");
  } finally {
    isLoading.value = false;
  }
}

async function loadMapState(airportId?: string): Promise<void> {
  try {
    mapState.value = await getDashboardMapState(airportId);
  } catch {
    // Dashboard remains usable if the map detail refresh fails.
  }
}

function openSelectedAirport(): void {
  const target = selectedAirport.value?.cta_target_path;

  if (target) {
    void router.push(target);
  }
}

async function refreshDashboard(): Promise<void> {
  isRefreshing.value = true;
  await loadDashboard();
  isRefreshing.value = false;
}
</script>

<template>
  <main class="h-full overflow-y-auto bg-background text-text-primary">
    <div class="mx-auto flex max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <section class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <AirBadge
            :label="t('dashboard.badge')"
            variant="primary-soft"
          />
          <h1 class="mt-3 text-h2">
            {{ t("dashboard.title") }}
          </h1>
          <p class="mt-2 max-w-3xl text-body text-text-muted">
            {{ summary ? t("dashboard.subtitle.ready").replace("{airline}", summary.airline.name) : t("dashboard.subtitle.loading") }}
          </p>
        </div>
        <div
          v-if="summary"
          class="text-caption text-text-muted"
        >
          {{ t("dashboard.updated") }} {{ new Date(summary.updated_at).toLocaleTimeString(props.appLocale) }}
        </div>
      </section>

      <section
        v-if="isLoading"
        class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div class="min-h-96 animate-pulse rounded-lg border border-border bg-surface" />
        <div class="grid gap-3">
          <div class="h-32 animate-pulse rounded-lg border border-border bg-surface" />
          <div class="h-48 animate-pulse rounded-lg border border-border bg-surface" />
        </div>
      </section>

      <section
        v-else-if="error"
        class="rounded-lg border border-error bg-error-bg p-5 text-slate-950"
      >
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <WifiOff
              class="shrink-0"
              :size="22"
            />
            <div class="min-w-0">
              <h2 class="text-subtitle">
                {{ t("dashboard.error.title") }}
              </h2>
              <p class="mt-1 text-body">
                {{ error }}
              </p>
            </div>
          </div>
          <AirButton
            :label="t('dashboard.refresh')"
            variant="danger-soft"
            @click="refreshDashboard"
          />
        </div>
      </section>

      <template v-else-if="summary">
        <DashboardNextAction
          :app-locale="props.appLocale"
          :is-refreshing="isRefreshing"
          :summary="summary"
          @refresh="refreshDashboard"
        />

        <DashboardMetricStrip
          :app-locale="props.appLocale"
          :summary="summary"
        />

        <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div class="min-w-0">
            <div class="relative h-[28rem] overflow-hidden rounded-lg border border-border bg-surface">
              <SvelteWrapper
                :create-fn="createMap"
                :component-props="{ appLocale: props.appLocale, controls: false, mapState, mode: 'dashboard', remoteId: 'map', rotation: false, selectedAirportId, shellPath: '/dashboard', theme: props.appTheme }"
              />
              <MapControls :app-locale="props.appLocale" />
              <div
                v-if="mapState?.warnings.length"
                class="absolute left-3 top-3 z-20 rounded-lg border border-warning bg-warning-bg px-3 py-2 text-caption text-slate-950"
              >
                <span class="inline-flex items-center gap-2">
                  <AlertTriangle :size="14" />
                  {{ t("dashboard.map.warning") }}
                </span>
              </div>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-3">
              <article class="rounded-lg border border-border bg-surface p-4">
                <div class="flex items-center gap-2 text-text-muted">
                  <Building2 :size="18" />
                  <span class="text-caption">{{ t("dashboard.base.title") }}</span>
                </div>
                <h2 class="mt-2 truncate text-subtitle">
                  {{ summary.base.airport?.label ?? t("dashboard.base.missing") }}
                </h2>
                <p class="mt-2 text-caption text-text-muted">
                  {{ t("dashboard.base.runway") }} {{ formatNumber(summary.base.airport?.max_runway_length_m) }} {{ t("unit.meterShort") }}
                </p>
                <p class="text-caption text-text-muted">
                  {{ t("dashboard.base.slots") }} {{ formatNumber(summary.base.airport?.max_runway_uses_per_day) }}/{{ t("unit.dayShort") }}
                </p>
              </article>

              <article class="rounded-lg border border-border bg-surface p-4">
                <div class="flex items-center gap-2 text-text-muted">
                  <Plane :size="18" />
                  <span class="text-caption">{{ t("dashboard.fleet.title") }}</span>
                </div>
                <h2 class="mt-2 text-subtitle">
                  {{ formatNumber(summary.fleet.ready_aircraft) }} / {{ formatNumber(summary.fleet.total_aircraft) }}
                </h2>
                <p class="mt-2 text-caption text-text-muted">
                  {{ t("dashboard.fleet.value") }} {{ formatMoney(summary.fleet.fleet_value) }}
                </p>
              </article>

              <article class="rounded-lg border border-border bg-surface p-4">
                <div class="flex items-center gap-2 text-text-muted">
                  <Route :size="18" />
                  <span class="text-caption">{{ t("dashboard.routes.title") }}</span>
                </div>
                <h2 class="mt-2 text-subtitle">
                  {{ formatNumber(summary.routes.active_routes) }}
                </h2>
                <p class="mt-2 text-caption text-text-muted">
                  {{ t("dashboard.capability.routesPending") }}
                </p>
              </article>
            </div>
          </div>

          <aside class="grid min-w-0 gap-5">
            <section
              v-if="selectedAirport"
              class="rounded-lg border border-border bg-surface p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-caption text-text-muted">
                    {{ t("dashboard.map.selectedAirport") }}
                  </p>
                  <h2 class="mt-1 truncate text-subtitle">
                    {{ selectedAirport.airport.label }}
                  </h2>
                </div>
                <MapPin
                  class="shrink-0 text-primary"
                  :size="20"
                />
              </div>
              <div class="mt-4 grid gap-2 text-caption text-text-muted">
                <span>{{ t("dashboard.map.demand") }} {{ formatNumber(selectedAirport.demand) }}</span>
                <span>{{ t("dashboard.base.runway") }} {{ formatNumber(selectedAirport.airport.max_runway_length_m) }} {{ t("unit.meterShort") }}</span>
                <span>{{ t("dashboard.base.slots") }} {{ formatNumber(selectedAirport.airport.max_runway_uses_per_day) }}/{{ t("unit.dayShort") }}</span>
              </div>
              <AirButton
                class="mt-4 w-full"
                :label="t('dashboard.openAction')"
                size="sm"
                variant="primary-soft"
                @click="openSelectedAirport"
              />
            </section>

            <DashboardAlerts
              :alerts="summary.alerts"
              :app-locale="props.appLocale"
            />
            <DashboardProgressNav
              :app-locale="props.appLocale"
              :items="summary.navigation_progress"
            />
          </aside>
        </section>
      </template>
    </div>
  </main>
</template>
