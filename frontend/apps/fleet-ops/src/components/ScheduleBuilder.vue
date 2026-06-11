<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { HubOption, OperationAircraftOption, OperationRoute, OperationSchedule, ScheduleOptionsResponse } from "../types";
import type { TimelineBar } from "./schedule-types";

import { createRoute, getHubs, getScheduleOptions, replaceAircraftSchedule } from "../api";
import { useUtcOffset } from "../composables/useUtcOffset";
import { formatMoneyValue } from "../formatters";
import { analyzeScheduleReadiness } from "../schedule-readiness";
import FerryFlightForm from "./FerryFlightForm.vue";
import RoutePicker from "./RoutePicker.vue";
import { barsConflict, buildBlockBars, routeCode, routeHours } from "./schedule-bars";
import ScheduleAircraftPanel from "./ScheduleAircraftPanel.vue";
import ScheduleTimeline from "./ScheduleTimeline.vue";
import { type ScheduleBlock, useScheduleDrag } from "./useScheduleDrag";

const props = defineProps<{ appLocale: Locale; appTheme?: "dark" | "light"; shellPath?: string; t: (key: FleetMessageKey | string) => string; }>();
const TURNAROUND_MINUTES = 90;
const initialRouteId = new URLSearchParams(props.shellPath?.split("?")[1] ?? "").get("route_id") ?? "";
const aircraft = ref<OperationAircraftOption[]>([]); const armedRouteId = ref(""); const blocks = ref<ScheduleBlock[]>([]);
const baselineSignature = ref(""); const error = ref(""); const isLoading = ref(false); const isSaving = ref(false);
const routes = ref<OperationRoute[]>([]); const selectedAircraftId = ref(""); const success = ref(""); const schedules = ref<OperationSchedule[]>([]);
const hubs = ref<HubOption[]>([]); const oneWayMode = ref(false);

const selectedAircraftOption = computed(() => aircraft.value.find((item) => item.aircraft.id === selectedAircraftId.value));
const utilizationHours = computed(() => blocks.value.reduce((total, b) => total + routeHours(routeById.value.get(b.routeId)) * legsPerBlock(b), 0));
const utilizationPercent = computed(() => Math.min(100, Math.round((utilizationHours.value / 168) * 100)));
const utilizationTone = computed(() => (utilizationPercent.value > 90 && "warning") || (utilizationPercent.value > 70 && "success") || "primary");
const aircraftOptions = computed(() => aircraft.value.map((opt) => ({ label: `${opt.aircraft.tail_number ?? opt.aircraft.id ?? "-"}${opt.compatible ? "" : " · blocked"}`, value: opt.aircraft.id ?? "" })));
const armedRoute = computed(() => routeById.value.get(armedRouteId.value));

const placements = computed(() => {
  const flagged = new Set(readiness.value.issues.map((issue) => issue.blockId));
  const byDay = new Map<number, TimelineBar[]>();
  for (const block of blocks.value) {
    for (const bar of barsForBlock(block)) {
      byDay.set(bar.day, [...(byDay.get(bar.day) ?? []), { ...bar, warning: flagged.has(block.id) }]);
    }
  }
  return [...byDay.entries()].map(([day, bars]) => ({ bars, day }));
});

const currentSignature = computed(() => signatureFor(blocks.value));
const isDirty = computed(() => currentSignature.value !== baselineSignature.value);
const weeklyFlights = computed(() => blocks.value.reduce((total, b) => total + legsPerBlock(b), 0));
const weeklyProfit = computed(() => blocks.value.reduce((tot, b) => tot + (routeById.value.get(b.routeId)?.economics_snapshot?.estimated_profit_per_flight ?? 0) * legsPerBlock(b), 0));
const routeById = computed(() => new Map(routes.value.map((route) => [route.id, route])));
const hubIdSet = computed(() => new Set(hubs.value.map((hub) => hub.airport_id)));
const armedRouteHubToHub = computed(() => isHubToHub(armedRoute.value));
const startAirportId = computed(() => {
  const card = selectedAircraftOption.value?.aircraft;
  return card?.currentLocation?.airport?.id || card?.base_airport_id || card?.baseAirport?.id || undefined;
});
const readiness = computed(() => analyzeScheduleReadiness({
  blocks: blocks.value,
  routeById: routeById.value,
  startAirportId: startAirportId.value,
}));

/** UTC offset of the selected aircraft's hub airport (hours). Reactive: updates when aircraft changes. */
const hubUtcOffsetHours = useUtcOffset(() => selectedAircraftOption.value?.aircraft?.baseAirport?.timezone);

const { drag, onBarPointerDown, startRouteDrag } = useScheduleDrag({
  blocks, hasConflict: blockHasConflict, moveBlock,
  oneWayForPayload: (payloadId, kind) => kind === "block"
    ? Boolean(blocks.value.find((b) => b.id === payloadId)?.oneWay)
    : oneWayMode.value && isHubToHub(routeById.value.get(payloadId)),
  placeBlock,
  previewWidthForRoute: (rId) => (routeHours(routeById.value.get(rId)) / 24) * 100,
  routeHoursForRoute: (rId) => routeHours(routeById.value.get(rId)),
  routeLabel: (rId) => routeCode(routeById.value.get(rId)),
  setArmedRoute: (rId) => { armedRouteId.value = rId; },
  turnaroundHours: TURNAROUND_MINUTES / 60,
  get utcOffsetHours() { return hubUtcOffsetHours.value; },
});

onMounted(() => { void loadOptions(); });
watch(selectedAircraftId, () => { resetBlocksForAircraft(selectedAircraftId.value); });

function applyOptionsResponse(response: ScheduleOptionsResponse): void {
  aircraft.value = response.aircraft;
  routes.value = response.routes;
  schedules.value = response.schedules;
  selectedAircraftId.value ||= preferredAircraftId(response);
  armedRouteId.value ||= initialRouteId || response.route?.id || "";
  resetBlocksForAircraft(selectedAircraftId.value);
}

function barsForBlock(block: ScheduleBlock) {
  return buildBlockBars(block, routeById.value.get(block.routeId), TURNAROUND_MINUTES, hubUtcOffsetHours.value);
}
const dayLabel = (day: number) => new Intl.DateTimeFormat(props.appLocale, { weekday: "short" }).format(new Date(Date.UTC(2024, 0, 7 + day)));
const formatMoney = (val: number) => formatMoneyValue(props.appLocale, val);

function blockHasConflict(candidate: ScheduleBlock, ignoredBlockId = "") {
  return blocks.value.filter((b) => b.id !== ignoredBlockId).some((b) => barsConflict(barsForBlock(b), barsForBlock(candidate)));
}

function existingBlocksForAircraft(aircraftId: string) {
  return schedules.value
    .filter((s) => s.status === "active" && s.aircraft_id === aircraftId)
    .flatMap((s) => s.pattern.days_of_week.map((day) => ({
      day, id: `existing-${s.id}-${day}`, oneWay: s.pattern.round_trip === false, routeId: s.route_id, saved: true, time: s.pattern.departure_local_time,
    })));
}

function isHubToHub(route: OperationRoute | undefined): boolean {
  return Boolean(route && hubIdSet.value.has(route.origin_airport_id) && hubIdSet.value.has(route.destination_airport_id));
}

function legsPerBlock(block: ScheduleBlock): number {
  return block.oneWay ? 1 : 2;
}

async function loadOptions(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    const [options, hubsResponse] = await Promise.all([
      getScheduleOptions(initialRouteId || undefined),
      getHubs().catch(() => ({ hubs: [] })),
    ]);
    hubs.value = hubsResponse.hubs;
    applyOptionsResponse(options);
  }
  catch (err) { error.value = err instanceof Error ? err.message : props.t("error.operations"); }
  finally { isLoading.value = false; }
}

async function materializePendingRoutes(): Promise<Map<string, string>> {
  const pendingIds = [...new Set(blocks.value.map((b) => b.routeId).filter((id) => id.startsWith("pending:")))];
  const entries = await Promise.all(pendingIds.map(async (tempId) => {
    const r = routeById.value.get(tempId);
    if (!r) {return null;}
    const res = await createRoute({ base_frequency_per_week: 3, destination_airport_id: r.destination_airport_id, origin_airport_id: r.origin_airport_id, selected_aircraft_id: selectedAircraftId.value || undefined });
    return [tempId, res.route.id] as const;
  }));
  return new Map(entries.filter((entry): entry is readonly [string, string] => entry !== null));
}

function moveBlock(barId: string, day: number, time: string): void {
  const blockId = barId.replace(/(~r)?@\d+$/, "").replace(/~r$/, "");
  const current = blocks.value.find((b) => b.id === blockId);
  if (!current) {return;}
  const candidate = { ...current, day, time };
  if (blockHasConflict(candidate, blockId)) {
    error.value = props.t("operations.builder.overlap");
  } else {
    error.value = "";
    blocks.value = blocks.value.map((b) => (b.id === blockId ? candidate : b));
  }
}

const onFerryCreated = () => {
  airlineSimEventBus.emit("game:snapshot-invalidated", { reason: "manual-refresh", source: "fleet-ops" });
  void loadOptions();
};

function airportLabelById(airportId: string): string {
  for (const route of routes.value) {
    if (route.origin_airport_id === airportId && route.origin_airport) { return route.origin_airport.iata_code ?? route.origin_airport.label; }
    if (route.destination_airport_id === airportId && route.destination_airport) { return route.destination_airport.iata_code ?? route.destination_airport.label; }
  }
  return hubs.value.find((hub) => hub.airport_id === airportId)?.label ?? airportId;
}

const onRouteResolved = (route: OperationRoute) => {
  if (!routes.value.some((item) => item.id === route.id)) {routes.value = [...routes.value, route];}
  armedRouteId.value = route.id;
  error.value = "";
};

function placeBlock(day: number, time: string, routeId?: string): void {
  const selRoute = routeId ?? armedRouteId.value;
  if (!selRoute) { error.value = props.t("operations.builder.armFirst"); return; }
  const oneWay = oneWayMode.value && isHubToHub(routeById.value.get(selRoute));
  const candidate = { day, id: crypto.randomUUID(), oneWay, routeId: selRoute, time };
  if (blockHasConflict(candidate)) { error.value = props.t("operations.builder.overlap"); return; }
  error.value = "";
  armedRouteId.value = selRoute;
  blocks.value = [...blocks.value, candidate];
}

function preferredAircraftId(res: ScheduleOptionsResponse) {
  return res.schedules.find((s) => s.status === "active")?.aircraft_id ??
    res.aircraft.find((o) => o.compatible)?.aircraft.id ??
    res.aircraft[0]?.aircraft.id ?? "";
}

function removeBar(barId: string) {
  blocks.value = blocks.value.filter((b) => b.id !== barId.replace(/(~r)?@\d+$/, "").replace(/~r$/, ""));
}

function resetBlocksForAircraft(aircraftId: string) {
  const next = existingBlocksForAircraft(aircraftId);
  blocks.value = next;
  baselineSignature.value = signatureFor(next);
  error.value = "";
  success.value = "";
}

async function save(): Promise<void> {
  if (!selectedAircraftId.value || !isDirty.value) {return;}
  isSaving.value = true;
  error.value = "";
  success.value = "";
  try {
    const routeIdMap = await materializePendingRoutes();
    await replaceAircraftSchedule({
      aircraft_id: selectedAircraftId.value,
      blocks: blocks.value.map((b) => ({
        day: b.day,
        departure_local_time: b.time,
        round_trip: !b.oneWay,
        route_id: routeIdMap.get(b.routeId) ?? b.routeId,
      })),
      round_trip: true,
      turnaround_minutes: TURNAROUND_MINUTES,
    });
    success.value = props.t("operations.success");
    for (const ev of ["game:snapshot-invalidated", "events:invalidated", "notifications:invalidated"]) {
      airlineSimEventBus.emit(ev as any, { reason: "schedule-activated", source: "fleet-ops" });
    }
    await loadOptions();
  } catch (err) {
    error.value = err instanceof Error ? err.message : props.t("error.operations");
  } finally {
    isSaving.value = false;
  }
}

function signatureFor(list: ScheduleBlock[]) {
  return list.map((b) => `${b.day}|${b.time}|${b.routeId}|${b.oneWay ? "ow" : "rt"}`).sort().join(";");
}
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <header class="border-b border-border pb-4">
      <h1 class="text-h2">
        {{ props.t("operations.schedule.title") }}
      </h1>
      <p class="mt-1 max-w-2xl text-body text-text-muted">
        {{ props.t("operations.schedule.subtitle") }}
      </p>
    </header>

    <ScheduleAircraftPanel
      v-model="selectedAircraftId"
      :aircraft-options="aircraftOptions"
      :selected-aircraft-option="selectedAircraftOption"
      :t="props.t"
      :utilization-hours="utilizationHours"
      :utilization-percent="utilizationPercent"
      :utilization-tone="utilizationTone"
    />

    <div
      v-if="error || success"
      class="mt-4 rounded-lg border p-3"
      :class="error ? 'border-error bg-error-bg text-error' : 'border-success bg-success-bg text-success'"
    >
      {{ error || success }}
    </div>

    <div class="mt-5 grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside class="grid content-start gap-3 rounded-lg border border-border bg-surface p-3">
        <p class="text-caption text-text-muted">
          {{ props.t("operations.routePicker.title") }}
        </p>
        <RoutePicker
          :app-locale="props.appLocale"
          :app-theme="props.appTheme"
          :existing-routes="routes"
          :initial-destination-id="armedRoute?.destination_airport_id"
          :initial-origin-id="armedRoute?.origin_airport_id"
          :selected-aircraft-id="selectedAircraftId"
          :t="props.t"
          @route-resolved="onRouteResolved"
        />

        <div
          v-if="armedRoute"
          class="flex touch-none select-none items-center justify-between gap-2 rounded-md border border-primary bg-primary-soft px-3 py-2 text-caption text-on-primary-soft active:cursor-grabbing"
          @pointerdown="startRouteDrag(armedRoute.id, $event)"
        >
          <span class="truncate font-semibold">{{ routeCode(armedRoute) }}</span>
          <span class="shrink-0">{{ formatMoney(armedRoute.economics_snapshot?.estimated_profit_per_flight ?? 0) }}</span>
        </div>
        <label
          v-if="armedRouteHubToHub"
          class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-caption text-text-primary"
        >
          <input
            v-model="oneWayMode"
            class="accent-primary"
            type="checkbox"
          />
          <span>{{ props.t("operations.oneWay") }}</span>
        </label>
        <p class="text-caption text-text-muted">
          {{ props.t("operations.routePicker.dragHint") }}
        </p>

        <FerryFlightForm
          :app-locale="props.appLocale"
          :selected-aircraft-id="selectedAircraftId"
          :t="props.t"
          @created="onFerryCreated"
        />
      </aside>

      <div class="grid min-w-0 content-start gap-3">
        <ScheduleTimeline
          :armed="Boolean(armedRouteId)"
          :day-label="dayLabel"
          :drag="drag"
          :placements="placements"
          :t="props.t"
          :timezone="selectedAircraftOption?.aircraft?.baseAirport?.timezone"
          @bar-pointer-down="onBarPointerDown"
          @place="placeBlock"
          @remove="removeBar"
        />

        <div
          v-if="readiness.issues.length || !readiness.periodic"
          class="rounded-lg border border-warning bg-warning-bg p-4 text-warning"
        >
          <strong class="block text-caption font-bold uppercase tracking-wide">
            {{ props.t("operations.readiness.title") }}
          </strong>
          <ul class="mt-2 grid gap-1 pl-4 text-caption list-disc">
            <li
              v-for="issue in readiness.issues"
              :key="issue.blockId"
            >
              {{ routeCode(routeById.get(issue.routeId)) }} · {{ dayLabel(issue.day) }} {{ issue.time }} —
              {{ props.t("operations.readiness.expectedAt") }} {{ airportLabelById(issue.expectedAirportId) }}.
              {{ props.t("operations.readiness.autoCancel") }}
            </li>
            <li v-if="!readiness.periodic">
              {{ props.t("operations.readiness.notPeriodic") }}
            </li>
          </ul>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
          <div class="flex flex-wrap items-center gap-6">
            <div class="flex flex-col">
              <span class="text-caption font-medium text-text-muted">{{ props.t("operations.builder.flights") }}</span>
              <span class="text-subtitle font-bold text-text-primary mt-0.5">{{ weeklyFlights }}</span>
            </div>
            <div class="flex flex-col">
              <span class="text-caption font-medium text-text-muted">{{ props.t("operations.weeklyProfit") }}</span>
              <span class="text-subtitle font-bold mt-0.5" :class="weeklyProfit >= 0 ? 'text-success' : 'text-error'">
                {{ formatMoney(weeklyProfit) }}
              </span>
            </div>
          </div>
          <AirButton
            :disabled="!isDirty || isSaving"
            :label="isSaving ? '...' : props.t('action.saveSchedule')"
            @click="save"
          />
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="drag.active"
        class="pointer-events-none fixed z-50 flex h-6 -translate-x-1/2 -translate-y-[140%] items-center rounded px-2 text-[10px] font-semibold shadow-lg"
        :class="drag.valid || drag.hoverDay === null ? 'bg-primary text-on-primary' : 'bg-error text-white'"
        :style="{ left: `${drag.x}px`, top: `${drag.y}px` }"
      >
        {{ drag.label }}<span v-if="drag.hoverTime" class="ml-1 opacity-80">· {{ drag.hoverTime }}</span>
      </div>
    </Teleport>
  </section>
</template>
