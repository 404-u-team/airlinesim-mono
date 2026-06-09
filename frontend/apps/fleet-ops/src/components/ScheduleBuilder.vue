<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirSelect } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { OperationAircraftOption, OperationRoute, OperationSchedule, ScheduleOptionsResponse } from "../types";
import type { TimelineBar } from "./schedule-types";

import { createRoute, getScheduleOptions, replaceAircraftSchedule } from "../api";
import { formatMoneyValue } from "../formatters";
import FerryFlightForm from "./FerryFlightForm.vue";
import RoutePicker from "./RoutePicker.vue";
import { barsConflict, buildBlockBars, routeCode, routeHours } from "./schedule-bars";
import ScheduleTimeline from "./ScheduleTimeline.vue";
import { type ScheduleBlock, useScheduleDrag } from "./useScheduleDrag";

const props = defineProps<{
  appLocale: Locale;
  appTheme?: "dark" | "light";
  shellPath?: string;
  t: (key: FleetMessageKey | string) => string;
}>();

const TURNAROUND_MINUTES = 90;
const initialRouteId = new URLSearchParams(props.shellPath?.split("?")[1] ?? "").get("route_id") ?? "";

const aircraft = ref<OperationAircraftOption[]>([]);
const armedRouteId = ref("");
const blocks = ref<ScheduleBlock[]>([]);
const baselineSignature = ref("");
const error = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const routes = ref<OperationRoute[]>([]);
const selectedAircraftId = ref("");
const success = ref("");
const schedules = ref<OperationSchedule[]>([]);

const aircraftOptions = computed(() =>
  aircraft.value.map((option) => ({
    label: `${option.aircraft.tail_number ?? option.aircraft.id ?? "-"}${option.compatible ? "" : " · blocked"}`,
    value: option.aircraft.id ?? "",
  })),
);
const armedRoute = computed(() => routeById.value.get(armedRouteId.value));
const placements = computed(() => {
  const byDay = new Map<number, TimelineBar[]>();

  for (const block of blocks.value) {
    for (const bar of barsForBlock(block)) {
      byDay.set(bar.day, [...(byDay.get(bar.day) ?? []), bar]);
    }
  }

  return [...byDay.entries()].map(([day, bars]) => ({ bars, day }));
});
const currentSignature = computed(() => signatureFor(blocks.value));
const isDirty = computed(() => currentSignature.value !== baselineSignature.value);
const weeklyFlights = computed(() => blocks.value.length * 2);
const weeklyProfit = computed(() =>
  blocks.value.reduce((total, block) => {
    const profit = routeById.value.get(block.routeId)?.economics_snapshot?.estimated_profit_per_flight ?? 0;

    return total + profit * 2;
  }, 0),
);
const routeById = computed(() => new Map(routes.value.map((route) => [route.id, route])));

const { drag, onBarPointerDown, startRouteDrag } = useScheduleDrag({
  blocks,
  hasConflict: blockHasConflict,
  moveBlock,
  placeBlock,
  previewWidthForRoute: (routeId) => (routeHours(routeById.value.get(routeId)) / 24) * 100,
  routeLabel: (routeId) => routeCode(routeById.value.get(routeId)),
  setArmedRoute: (routeId) => {
    armedRouteId.value = routeId;
  },
});

onMounted(() => {
  void loadOptions();
});

watch(selectedAircraftId, () => {
  resetBlocksForAircraft(selectedAircraftId.value);
});

function applyOptionsResponse(response: ScheduleOptionsResponse): void {
  aircraft.value = response.aircraft;
  routes.value = response.routes;
  schedules.value = response.schedules;
  selectedAircraftId.value ||= preferredAircraftId(response);
  armedRouteId.value ||= initialRouteId || response.route?.id || "";
  resetBlocksForAircraft(selectedAircraftId.value);
}

function barsForBlock(block: ScheduleBlock): TimelineBar[] {
  return buildBlockBars(block, routeById.value.get(block.routeId), TURNAROUND_MINUTES);
}

function blockHasConflict(candidate: ScheduleBlock, ignoredBlockId = ""): boolean {
  const candidateBars = barsForBlock(candidate);
  const otherBlocks = blocks.value.filter((block) => block.id !== ignoredBlockId);

  return otherBlocks.some((block) => barsConflict(barsForBlock(block), candidateBars));
}

function dayLabel(day: number): string {
  return new Intl.DateTimeFormat(props.appLocale, { weekday: "short" }).format(new Date(Date.UTC(2024, 0, 7 + day)));
}

function existingBlocksForAircraft(aircraftId: string): ScheduleBlock[] {
  return schedules.value
    .filter((schedule) => schedule.status === "active" && schedule.aircraft_id === aircraftId)
    .flatMap((schedule) => schedule.pattern.days_of_week.map((day) => ({
      day,
      id: `existing-${schedule.id}-${day}`,
      routeId: schedule.route_id,
      saved: true,
      time: schedule.pattern.departure_local_time,
    })));
}

function formatMoney(value: number): string {
  return formatMoneyValue(props.appLocale, value);
}

async function loadOptions(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    applyOptionsResponse(await getScheduleOptions(initialRouteId || undefined));
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.operations");
  } finally {
    isLoading.value = false;
  }
}

async function materializePendingRoutes(): Promise<Map<string, string>> {
  // Routes are only created on save (deferred), so turn any "pending:" placeholders into real routes first.
  const pendingIds = [...new Set(blocks.value.map((block) => block.routeId).filter((id) => id.startsWith("pending:")))];
  const entries = await Promise.all(pendingIds.map(async (tempId) => {
    const route = routeById.value.get(tempId);
    if (!route) {
      return null;
    }
    const response = await createRoute({
      base_frequency_per_week: 3,
      destination_airport_id: route.destination_airport_id,
      origin_airport_id: route.origin_airport_id,
      selected_aircraft_id: selectedAircraftId.value || undefined,
    });

    return [tempId, response.route.id] as const;
  }));

  return new Map(entries.filter((entry): entry is readonly [string, string] => entry !== null));
}

function moveBlock(barId: string, day: number, time: string): void {
  const blockId = barId.replace(/(~r)?@\d+$/, "").replace(/~r$/, "");
  const existingBlock = blocks.value.find((block) => block.id === blockId);

  if (!existingBlock) {
    return;
  }
  const candidate = { ...existingBlock, day, time };
  if (blockHasConflict(candidate, blockId)) {
    error.value = props.t("operations.builder.overlap");
    return;
  }
  error.value = "";
  blocks.value = blocks.value.map((block) => (block.id === blockId ? candidate : block));
}

function onFerryCreated(): void {
  airlineSimEventBus.emit("game:snapshot-invalidated", { reason: "manual-refresh", source: "fleet-ops" });
  void loadOptions();
}

function onRouteResolved(route: OperationRoute): void {
  if (!routes.value.some((item) => item.id === route.id)) {
    routes.value = [...routes.value, route];
  }
  armedRouteId.value = route.id;
  error.value = "";
}

function placeBlock(day: number, time: string, routeId?: string): void {
  const selectedRoute = routeId ?? armedRouteId.value;

  if (!selectedRoute) {
    error.value = props.t("operations.builder.armFirst");

    return;
  }

  const candidate = { day, id: crypto.randomUUID(), routeId: selectedRoute, time };
  if (blockHasConflict(candidate)) {
    error.value = props.t("operations.builder.overlap");
    return;
  }
  error.value = "";
  armedRouteId.value = selectedRoute;
  blocks.value = [...blocks.value, candidate];
}

function preferredAircraftId(response: ScheduleOptionsResponse): string {
  return response.schedules.find((schedule) => schedule.status === "active")?.aircraft_id
    ?? response.aircraft.find((option) => option.compatible)?.aircraft.id
    ?? response.aircraft[0]?.aircraft.id
    ?? "";
}

function removeBar(barId: string): void {
  const blockId = barId.replace(/(~r)?@\d+$/, "").replace(/~r$/, "");
  blocks.value = blocks.value.filter((block) => block.id !== blockId);
}

function resetBlocksForAircraft(aircraftId: string): void {
  const next = existingBlocksForAircraft(aircraftId);
  blocks.value = next;
  baselineSignature.value = signatureFor(next);
  error.value = "";
  success.value = "";
}

async function save(): Promise<void> {
  if (!selectedAircraftId.value || !isDirty.value) {
    return;
  }

  isSaving.value = true;
  error.value = "";
  success.value = "";

  try {
    const routeIdMap = await materializePendingRoutes();
    await replaceAircraftSchedule({
      aircraft_id: selectedAircraftId.value,
      blocks: blocks.value.map((block) => ({ day: block.day, departure_local_time: block.time, route_id: routeIdMap.get(block.routeId) ?? block.routeId })),
      round_trip: true,
      turnaround_minutes: TURNAROUND_MINUTES,
    });
    success.value = props.t("operations.success");
    airlineSimEventBus.emit("game:snapshot-invalidated", { reason: "schedule-activated", source: "fleet-ops" });
    airlineSimEventBus.emit("events:invalidated", { reason: "schedule-activated", source: "fleet-ops" });
    airlineSimEventBus.emit("notifications:invalidated", { reason: "schedule-activated", source: "fleet-ops" });
    await loadOptions();
  } catch (saveError) {
    error.value = saveError instanceof Error ? saveError.message : props.t("error.operations");
  } finally {
    isSaving.value = false;
  }
}

function signatureFor(list: ScheduleBlock[]): string {
  return list
    .map((block) => `${block.day}|${block.time}|${block.routeId}`)
    .sort()
    .join(";");
}
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <header class="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 class="text-h2">
          {{ props.t("operations.schedule.title") }}
        </h1>
        <p class="mt-1 max-w-2xl text-body text-text-muted">
          {{ props.t("operations.schedule.subtitle") }}
        </p>
      </div>
      <div class="flex min-w-0 flex-col gap-1.5">
        <span class="text-caption text-text-muted">{{ props.t("operations.selectAircraft") }}</span>
        <AirSelect
          v-model="selectedAircraftId"
          label="Aircraft"
          :options="aircraftOptions"
        />
      </div>
    </header>

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
          @bar-pointer-down="onBarPointerDown"
          @place="placeBlock"
          @remove="removeBar"
        />

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
          <div class="flex gap-5 text-caption">
            <span>{{ props.t("operations.builder.flights") }}: <strong>{{ weeklyFlights }}</strong></span>
            <span :class="weeklyProfit >= 0 ? 'text-success' : 'text-error'">
              {{ props.t("operations.weeklyProfit") }}: <strong>{{ formatMoney(weeklyProfit) }}</strong>
            </span>
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
