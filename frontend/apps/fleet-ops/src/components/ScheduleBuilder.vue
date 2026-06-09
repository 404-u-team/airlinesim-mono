<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirAircraftThumb, AirButton, AirProgressBar, AirSelect } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { OperationAircraftOption, OperationRoute, OperationSchedule, ScheduleOptionsResponse } from "../types";
import type { TimelineBar } from "./schedule-types";

import { createRoute, getScheduleOptions, replaceAircraftSchedule } from "../api";
import { useUtcOffset } from "../composables/useUtcOffset";
import { formatMoneyValue } from "../formatters";
import FerryFlightForm from "./FerryFlightForm.vue";
import RoutePicker from "./RoutePicker.vue";
import { barsConflict, buildBlockBars, routeCode, routeHours } from "./schedule-bars";
import ScheduleTimeline from "./ScheduleTimeline.vue";
import { type ScheduleBlock, useScheduleDrag } from "./useScheduleDrag";

const props = defineProps<{ appLocale: Locale; appTheme?: "dark" | "light"; shellPath?: string; t: (key: FleetMessageKey | string) => string; }>();
const TURNAROUND_MINUTES = 90;
const initialRouteId = new URLSearchParams(props.shellPath?.split("?")[1] ?? "").get("route_id") ?? "";
const aircraft = ref<OperationAircraftOption[]>([]); const armedRouteId = ref(""); const blocks = ref<ScheduleBlock[]>([]);
const baselineSignature = ref(""); const error = ref(""); const isLoading = ref(false); const isSaving = ref(false);
const routes = ref<OperationRoute[]>([]); const selectedAircraftId = ref(""); const success = ref(""); const schedules = ref<OperationSchedule[]>([]);

const selectedAircraftOption = computed(() => aircraft.value.find((item) => item.aircraft.id === selectedAircraftId.value));
const utilizationHours = computed(() => blocks.value.reduce((total, b) => total + routeHours(routeById.value.get(b.routeId)) * 2, 0));
const utilizationPercent = computed(() => Math.min(100, Math.round((utilizationHours.value / 168) * 100)));
const utilizationTone = computed(() => {
  if (utilizationPercent.value > 90) {return "warning";}
  if (utilizationPercent.value > 70) {return "success";}
  return "primary";
});
const aircraftOptions = computed(() => aircraft.value.map((opt) => ({ label: `${opt.aircraft.tail_number ?? opt.aircraft.id ?? "-"}${opt.compatible ? "" : " · blocked"}`, value: opt.aircraft.id ?? "" })));
const armedRoute = computed(() => routeById.value.get(armedRouteId.value));

const placements = computed(() => {
  const byDay = new Map<number, TimelineBar[]>();
  for (const block of blocks.value) {
    for (const bar of barsForBlock(block)) { byDay.set(bar.day, [...(byDay.get(bar.day) ?? []), bar]); }
  }
  return [...byDay.entries()].map(([day, bars]) => ({ bars, day }));
});

const currentSignature = computed(() => signatureFor(blocks.value));
const isDirty = computed(() => currentSignature.value !== baselineSignature.value);
const weeklyFlights = computed(() => blocks.value.length * 2);
const weeklyProfit = computed(() => blocks.value.reduce((tot, b) => tot + (routeById.value.get(b.routeId)?.economics_snapshot?.estimated_profit_per_flight ?? 0) * 2, 0));
const routeById = computed(() => new Map(routes.value.map((route) => [route.id, route])));

/** UTC offset of the selected aircraft's hub airport (hours). Reactive: updates when aircraft changes. */
const hubUtcOffsetHours = useUtcOffset(() => selectedAircraftOption.value?.aircraft?.baseAirport?.timezone);

const { drag, onBarPointerDown, startRouteDrag } = useScheduleDrag({
  blocks, hasConflict: blockHasConflict, moveBlock, placeBlock,
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
      day, id: `existing-${s.id}-${day}`, routeId: s.route_id, saved: true, time: s.pattern.departure_local_time,
    })));
}

async function loadOptions(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try { applyOptionsResponse(await getScheduleOptions(initialRouteId || undefined)); }
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

const onRouteResolved = (route: OperationRoute) => {
  if (!routes.value.some((item) => item.id === route.id)) {routes.value = [...routes.value, route];}
  armedRouteId.value = route.id;
  error.value = "";
};

function placeBlock(day: number, time: string, routeId?: string): void {
  const selRoute = routeId ?? armedRouteId.value;
  if (!selRoute) { error.value = props.t("operations.builder.armFirst"); return; }
  const candidate = { day, id: crypto.randomUUID(), routeId: selRoute, time };
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
      blocks: blocks.value.map((b) => ({ day: b.day, departure_local_time: b.time, route_id: routeIdMap.get(b.routeId) ?? b.routeId })),
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
  return list.map((b) => `${b.day}|${b.time}|${b.routeId}`).sort().join(";");
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

    <!-- Selected Aircraft Details & Utilization Card -->
    <section v-if="selectedAircraftOption" class="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-3">
          <AirAircraftThumb
            v-if="selectedAircraftOption.aircraft.type?.image_url"
            :alt="selectedAircraftOption.aircraft.modelName"
            :image-url="selectedAircraftOption.aircraft.type.image_url"
            size="md"
          />
          <div v-else class="grid size-12 select-none place-items-center rounded-lg bg-primary/10 text-xl font-bold uppercase text-primary">
            {{ selectedAircraftOption.aircraft.modelName.slice(0, 3) }}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-subtitle font-bold text-text-primary">
                {{ selectedAircraftOption.aircraft.tail_number || "No Tail Number" }}
              </h2>
              <span class="rounded border border-border bg-surface px-2 py-0.5 text-caption font-semibold text-text-muted">
                {{ selectedAircraftOption.aircraft.modelName }}
              </span>
            </div>
            <p class="mt-1 text-caption text-text-muted">
              {{ props.t("market.base") }}: <strong class="text-text-primary">{{ selectedAircraftOption.aircraft.baseAirportName }}</strong> · 
              {{ props.t("aircraft.status") }}: <strong class="text-text-primary">{{ selectedAircraftOption.aircraft.status || "Active" }}</strong>
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-6">
          <div class="flex flex-col gap-1 min-w-40">
            <span class="text-caption text-text-muted font-medium">{{ props.t("operations.selectAircraft") }}</span>
            <AirSelect
              v-model="selectedAircraftId"
              label="Aircraft"
              :options="aircraftOptions"
            />
          </div>

          <div class="w-full shrink-0 md:max-w-xs">
            <div class="mb-1 flex items-center justify-between text-caption font-medium">
              <span class="text-text-muted">{{ props.t("operations.utilization") }}</span>
              <span class="font-bold text-text-primary">{{ utilizationHours.toFixed(1) }}{{ props.t("unit.hourShort") }} / 168{{ props.t("unit.hourShort") }} ({{ utilizationPercent }}%)</span>
            </div>
            <AirProgressBar :percent="utilizationPercent" :tone="utilizationTone" />
          </div>
        </div>
      </div>

      <!-- Compatibility alerts if any -->
      <div
        v-if="!selectedAircraftOption.compatible && selectedAircraftOption.blockers.length"
        class="mt-3 rounded-lg border border-error bg-error-bg p-3 text-caption text-error"
      >
        <strong class="mb-1 block">Blocked constraints:</strong>
        <ul class="list-disc pl-4 space-y-0.5">
          <li v-for="blocker in selectedAircraftOption.blockers" :key="blocker.code">
            {{ blocker.message }}
          </li>
        </ul>
      </div>
    </section>

    <!-- Empty Aircraft Selector Placeholder -->
    <section v-else class="mt-4 rounded-lg border border-border bg-surface p-6 shadow-sm flex flex-col items-center justify-center gap-4 text-center max-w-lg mx-auto">
      <div class="grid size-12 place-items-center rounded-full bg-primary/10 text-2xl text-primary">
        ✈️
      </div>
      <div>
        <h3 class="text-subtitle font-bold text-text-primary">
          {{ aircraftOptions.length ? props.t("operations.selectAircraft") : "No Aircraft Available" }}
        </h3>
        <p class="text-caption text-text-muted mt-1 max-w-sm">
          {{ aircraftOptions.length ? "Please select an aircraft to view and manage its schedule." : "You do not own any aircraft yet. Buy your first aircraft in the Aircraft Market to start planning flights." }}
        </p>
      </div>
      <div v-if="aircraftOptions.length" class="w-64">
        <AirSelect
          v-model="selectedAircraftId"
          label="Aircraft"
          :options="aircraftOptions"
          class="w-full"
        />
      </div>
      <div v-else>
        <a href="/fleet/order/new" class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-caption font-semibold text-on-primary transition hover:bg-primary/90">
          {{ props.t("market.title") }}
        </a>
      </div>
    </section>

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
          :timezone="selectedAircraftOption?.aircraft?.baseAirport?.timezone"
          @bar-pointer-down="onBarPointerDown"
          @place="placeBlock"
          @remove="removeBar"
        />

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
