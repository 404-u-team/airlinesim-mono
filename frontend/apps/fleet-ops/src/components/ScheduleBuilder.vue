<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard, AirSelect, AirTextField } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { OperationAircraftOption, OperationReason, OperationRoute, ScheduleOptionsResponse, SchedulePreviewResponse } from "../types";

import { createSchedule, getScheduleOptions, getSchedulePreview } from "../api";
import { formatMoneyValue, formatNumberValue } from "../formatters";

const props = defineProps<{
  appLocale: Locale;
  t: (key: FleetMessageKey | string) => string;
}>();

const aircraft = ref<OperationAircraftOption[]>([]);
const days = ref<number[]>([1, 3, 5]);
const departureTime = ref("09:00");
const error = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const preview = ref<null | SchedulePreviewResponse["preview"]>(null);
const routes = ref<OperationRoute[]>([]);
const selectedAircraftId = ref("");
const selectedRouteId = ref("");
const success = ref("");
const turnaroundMinutes = ref("90");

const aircraftOptions = computed(() =>
  aircraft.value.map((option) => ({
    label: `${option.aircraft.tail_number ?? option.aircraft.id ?? "-"}${option.compatible ? "" : " · blocked"}`,
    value: option.aircraft.id ?? "",
  })),
);
const canActivate = computed(() => Boolean(preview.value?.canActivate && selectedAircraftId.value && selectedRouteId.value));
const routeOptions = computed(() =>
  routes.value.map((route) => ({
    label: routeLabel(route),
    value: route.id,
  })),
);

onMounted(() => {
  void loadOptions();
});

watch([selectedRouteId, selectedAircraftId, days, departureTime, turnaroundMinutes], () => {
  void loadPreview();
}, { deep: true });

async function activateSchedule(): Promise<void> {
  if (!canActivate.value) {
    return;
  }

  isSaving.value = true;
  error.value = "";
  success.value = "";

  try {
    await createSchedule(buildPayload());
    success.value = props.t("operations.success");
    airlineSimEventBus.emit("schedule:activated", {
      routeId: selectedRouteId.value,
      source: "fleet-ops",
    });
    airlineSimEventBus.emit("game:snapshot-invalidated", {
      reason: "schedule-activated",
      source: "fleet-ops",
    });
    airlineSimEventBus.emit("events:invalidated", { reason: "schedule-activated", source: "fleet-ops" });
    airlineSimEventBus.emit("notifications:invalidated", { reason: "schedule-activated", source: "fleet-ops" });
    airlineSimEventBus.emit("navigation:intent", {
      source: "mfe",
      targetPath: "/operations/live-flights",
    });
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.operations");
  } finally {
    isSaving.value = false;
  }
}

function applyOptionsResponse(response: ScheduleOptionsResponse): void {
  aircraft.value = response.aircraft;
  routes.value = response.routes;
  selectedRouteId.value ||= response.route?.id ?? response.routes[0]?.id ?? "";
  selectedAircraftId.value ||= getDefaultAircraftId(response);
  departureTime.value = response.default_pattern.departure_local_time;
  turnaroundMinutes.value = String(response.default_pattern.turnaround_minutes);
  days.value = response.default_pattern.days_of_week;
}

function buildPayload(): {
  aircraft_id: string;
  days_of_week: number[];
  departure_local_time: string;
  route_id: string;
  turnaround_minutes: number;
} {
  return {
    aircraft_id: selectedAircraftId.value,
    days_of_week: days.value,
    departure_local_time: departureTime.value,
    route_id: selectedRouteId.value,
    turnaround_minutes: Number(turnaroundMinutes.value) || 90,
  };
}

function formatMoney(value: number | undefined): string {
  return formatMoneyValue(props.appLocale, value);
}

function formatNumber(value: number | undefined): string {
  return formatNumberValue(props.appLocale, value);
}

function getDefaultAircraftId(response: ScheduleOptionsResponse): string {
  return response.aircraft.find((option) => option.compatible)?.aircraft.id ?? response.aircraft[0]?.aircraft.id ?? "";
}

function isDaySelected(day: number): boolean {
  return days.value.includes(day);
}

async function loadOptions(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const response = await getScheduleOptions();
    applyOptionsResponse(response);
    await loadPreview();
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.operations");
  } finally {
    isLoading.value = false;
  }
}

async function loadPreview(): Promise<void> {
  if (!selectedRouteId.value || !selectedAircraftId.value) {
    preview.value = null;
    return;
  }

  try {
    const response = await getSchedulePreview(buildPayload());
    preview.value = response.preview;
  } catch {
    preview.value = null;
  }
}

function reasonLabel(reason: OperationReason): string {
  const key = `warning.${reason.code}` as FleetMessageKey;

  return props.t(key) || reason.message;
}

function routeLabel(route: OperationRoute): string {
  return `${route.origin_airport?.label ?? route.origin_airport_id} -> ${route.destination_airport?.label ?? route.destination_airport_id}`;
}

function setFrequency(mode: "daily" | "three" | "weekly"): void {
  if (mode === "daily") {
    days.value = [0, 1, 2, 3, 4, 5, 6];
    return;
  }
  if (mode === "three") {
    days.value = [1, 3, 5];
    return;
  }
  days.value = [1];
}

function toggleDay(day: number): void {
  days.value = isDaySelected(day)
    ? days.value.filter((item) => item !== day)
    : [...days.value, day].sort((left, right) => left - right);
}
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <header class="border-b border-border pb-5">
      <AirBadge
        label="Fleet & Ops"
        variant="primary-soft"
      />
      <h1 class="mt-4 text-h2">
        {{ props.t("operations.schedule.title") }}
      </h1>
      <p class="mt-2 max-w-2xl text-body text-text-muted">
        {{ props.t("operations.schedule.subtitle") }}
      </p>
    </header>

    <div
      v-if="error || success"
      class="mt-4 rounded-lg border p-3"
      :class="error ? 'border-error bg-error-bg text-error' : 'border-success bg-success-bg text-success'"
    >
      {{ error || success }}
    </div>

    <div
      v-if="!isLoading && routes.length === 0"
      class="mt-5 rounded-lg border border-border bg-surface p-5"
    >
      <p class="text-body text-text-muted">
        {{ props.t("operations.empty.routes") }}
      </p>
      <AirButton
        class="mt-4"
        :label="props.t('action.openRoutes')"
        variant="primary-soft"
        @click="airlineSimEventBus.emit('navigation:intent', { source: 'mfe', targetPath: '/airports/routes' })"
      />
    </div>

    <div
      v-else
      class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]"
    >
      <div class="rounded-lg border border-border bg-surface p-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-caption text-text-muted">{{ props.t("operations.selectRoute") }}</span>
            <AirSelect
              v-model="selectedRouteId"
              label="Route"
              :options="routeOptions"
            />
          </div>
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-caption text-text-muted">{{ props.t("operations.selectAircraft") }}</span>
            <AirSelect
              v-model="selectedAircraftId"
              label="Aircraft"
              :options="aircraftOptions"
            />
          </div>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <AirButton
            :label="props.t('operations.frequency.daily')"
            size="sm"
            variant="primary-soft"
            @click="setFrequency('daily')"
          />
          <AirButton
            :label="props.t('operations.frequency.threeWeekly')"
            size="sm"
            variant="primary-soft"
            @click="setFrequency('three')"
          />
          <AirButton
            :label="props.t('operations.frequency.weekly')"
            size="sm"
            variant="primary-soft"
            @click="setFrequency('weekly')"
          />
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="day in [0, 1, 2, 3, 4, 5, 6]"
            :key="day"
            class="rounded-lg border px-3 py-2 text-body"
            :class="isDaySelected(day) ? 'border-primary bg-primary text-on-primary' : 'border-border bg-background'"
            type="button"
            @click="toggleDay(day)"
          >
            {{ day }}
          </button>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <AirTextField
            v-model="departureTime"
            :label="props.t('operations.time')"
            placeholder="09:00"
          />
          <AirTextField
            v-model="turnaroundMinutes"
            :label="props.t('operations.turnaround')"
          />
        </div>
      </div>

      <aside class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          {{ props.t("operations.preview") }}
        </h2>
        <div class="mt-4 grid gap-3">
          <AirMetricCard
            :label="props.t('operations.weeklyRevenue')"
            :value="formatMoney(preview?.economics.weekly_revenue)"
          />
          <AirMetricCard
            :label="props.t('operations.weeklyCost')"
            :value="formatMoney(preview?.economics.weekly_cost)"
          />
          <AirMetricCard
            :label="props.t('operations.weeklyProfit')"
            :tone="(preview?.economics.weekly_profit ?? 0) > 0 ? 'success' : 'warning'"
            :value="formatMoney(preview?.economics.weekly_profit)"
          />
          <AirMetricCard
            label="Utilization"
            :value="`${formatNumber(preview?.weekly_utilization_hours)} h`"
          />
        </div>

        <div
          v-if="preview?.blockers.length"
          class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error"
        >
          <ul class="list-inside list-disc">
            <li
              v-for="reason in preview.blockers"
              :key="reason.code"
            >
              {{ reasonLabel(reason) }}
            </li>
          </ul>
        </div>
        <div
          v-if="preview?.warnings.length"
          class="mt-4 rounded-lg border border-warning bg-warning-bg p-3 text-warning"
        >
          <ul class="list-inside list-disc">
            <li
              v-for="reason in preview.warnings"
              :key="reason.code"
            >
              {{ reasonLabel(reason) }}
            </li>
          </ul>
        </div>

        <AirButton
          class="mt-4 w-full"
          :disabled="!canActivate || isSaving"
          :label="isSaving ? '...' : props.t('action.activateSchedule')"
          @click="activateSchedule"
        />
      </aside>
    </div>
  </section>
</template>
