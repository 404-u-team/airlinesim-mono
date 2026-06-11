<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge } from "@airlinesim/air-ui";
import { computed, ref } from "vue";

import type { FlightCard } from "../types";

const props = defineProps<{
  appLocale: Locale;
  days: number[];
  departureTime: string;
  previewFlights: FlightCard[];
  routeLabel: string;
  t: (key: string) => string;
  turnaroundMinutes: number;
}>();

const emit = defineEmits<{
  "set-day-active": [day: number, active: boolean];
  "update-departure-time": [value: string];
  "update-turnaround-minutes": [value: number];
}>();

const DAY_MINUTES = 1440;
const SNAP_MINUTES = 30;
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

const dragging = ref(false);
const draggingDay = ref<null | number>(null);

const blockGeometry = computed(() => {
  const departure = timeToMinutes(props.departureTime);
  const outboundDuration = flightDurationMinutes(props.previewFlights[0]) || 120;
  const inboundDuration = flightDurationMinutes(props.previewFlights[1]) || outboundDuration;
  const returnDeparture = departure + outboundDuration + props.turnaroundMinutes;

  return {
    inbound: toBlockStyle(returnDeparture % DAY_MINUTES, inboundDuration),
    inboundOffset: Math.floor(returnDeparture / DAY_MINUTES),
    outbound: toBlockStyle(departure, outboundDuration),
  };
});
const hourMarks = Array.from({ length: 13 }, (_unused, index) => index * 2);

function dayLabel(day: number): string {
  return new Intl.DateTimeFormat(props.appLocale, { weekday: "short" }).format(new Date(Date.UTC(2024, 0, 7 + day)));
}

function dropOnLane(event: DragEvent, day: number): void {
  event.preventDefault();
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const minutes = snapMinutes(Math.round(ratio * DAY_MINUTES));
  const sourceDay = draggingDay.value;

  emit("update-departure-time", minutesToTime(minutes));
  emit("set-day-active", day, true);
  if (sourceDay !== null && sourceDay !== day) {
    emit("set-day-active", sourceDay, false);
  }
  stopDrag();
}

function flightDurationMinutes(flight: FlightCard | undefined): number {
  if (!flight) {
    return 0;
  }

  return Math.max(0, Math.round((new Date(flight.arrival_at).getTime() - new Date(flight.departure_at).getTime()) / 60_000));
}

function isDayActive(day: number): boolean {
  return props.days.includes(day);
}

function minutesToDuration(value: number): string {
  return `${String(Math.floor(value / 60))}${props.t("unit.hourShort")} ${String(value % 60)}${props.t("unit.minuteShort")}`;
}

function minutesToTime(value: number): string {
  const normalized = ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;

  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function snapMinutes(value: number): number {
  return Math.min(DAY_MINUTES - SNAP_MINUTES, Math.max(0, Math.round(value / SNAP_MINUTES) * SNAP_MINUTES));
}

function startDrag(event: DragEvent, day: number): void {
  dragging.value = true;
  draggingDay.value = day;
  event.dataTransfer?.setData("text/plain", "schedule-pair");
  event.dataTransfer?.setDragImage(event.currentTarget as Element, 16, 16);
}

function stopDrag(): void {
  dragging.value = false;
  draggingDay.value = null;
}

function timeToMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");

  return Number(hour) * 60 + Number(minute);
}

function toBlockStyle(startMinutes: number, durationMinutes: number): { left: string; width: string } {
  return {
    left: `${(startMinutes / DAY_MINUTES) * 100}%`,
    width: `${Math.max(5, (durationMinutes / DAY_MINUTES) * 100)}%`,
  };
}
</script>

<template>
  <section class="min-w-0 rounded-lg border border-border bg-surface">
    <div class="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h2 class="text-subtitle">
          {{ t("operations.visualEditor.title") }}
        </h2>
        <p class="mt-1 text-caption text-text-muted">
          {{ routeLabel || t("operations.timeline.empty") }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <AirBadge
          :label="`${t('operations.time')}: ${departureTime}`"
          variant="primary-soft"
        />
        <AirBadge
          :label="`${t('operations.turnaround')}: ${turnaroundMinutes}${t('unit.minuteShort')}`"
          variant="warning-soft"
        />
      </div>
    </div>

    <div class="p-4">
      <div class="min-w-0 overflow-x-auto">
        <div class="min-w-[66rem]">
          <div class="grid grid-cols-[4.75rem_minmax(0,1fr)] items-end gap-3 border-b border-border pb-2">
            <span class="text-caption text-text-muted">
              {{ t("operations.days.title") }}
            </span>
            <div class="flex justify-between text-[10px] text-text-muted">
              <span
                v-for="hour in hourMarks"
                :key="hour"
              >
                {{ String(hour).padStart(2, "0") }}:00
              </span>
            </div>
          </div>

          <div class="mt-3 grid gap-2">
            <div
              v-for="day in weekdayOrder"
              :key="day"
              class="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3"
            >
              <span
                class="rounded-md border px-2 py-2 text-center text-caption capitalize"
                :class="isDayActive(day) ? 'border-primary bg-primary text-on-primary' : 'border-border bg-background text-text-muted'"
              >
                {{ dayLabel(day) }}
              </span>
              <div
                class="relative h-24 overflow-hidden rounded-lg border bg-background"
                :class="[
                  isDayActive(day) ? 'border-primary/60' : 'border-dashed border-border',
                  dragging ? 'outline outline-2 outline-primary' : '',
                ]"
                @dragover.prevent
                @drop="dropOnLane($event, day)"
              >
                <div class="absolute inset-0 grid grid-cols-[repeat(48,minmax(0,1fr))]">
                  <span
                    v-for="index in 48"
                    :key="index"
                    class="border-l border-border/60 first:border-l-0"
                    :class="index % 2 === 1 ? 'bg-surface-subtle/40' : ''"
                  />
                </div>

                <p
                  v-if="!isDayActive(day)"
                  class="absolute inset-y-0 left-3 flex items-center text-caption text-text-muted"
                >
                  {{ t("operations.visualEditor.dropHere") }}
                </p>

                <template v-if="isDayActive(day)">
                  <button
                    class="absolute top-4 h-10 cursor-grab rounded-md border border-primary bg-primary px-3 text-left text-[11px] font-semibold text-on-primary shadow-sm active:cursor-grabbing"
                    draggable="true"
                    type="button"
                    :style="blockGeometry.outbound"
                    @dragend="stopDrag"
                    @dragstart="startDrag($event, day)"
                  >
                    <span class="block truncate">{{ t("operations.leg.outbound") }}</span>
                    <span class="block truncate opacity-80">
                      {{ departureTime }} · {{ minutesToDuration(flightDurationMinutes(previewFlights[0]) || 120) }}
                    </span>
                  </button>

                  <div
                    class="absolute top-14 h-9 rounded-md border border-success bg-success-bg px-3 text-[11px] font-semibold text-success"
                    :style="blockGeometry.inbound"
                  >
                    <span class="block truncate">{{ t("operations.leg.return") }}</span>
                    <span class="block truncate opacity-80">
                      {{ minutesToTime((timeToMinutes(departureTime) + (flightDurationMinutes(previewFlights[0]) || 120) + turnaroundMinutes) % 1440) }}
                      <template v-if="blockGeometry.inboundOffset">+{{ blockGeometry.inboundOffset }}</template>
                    </span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="border-t border-border p-4">
      <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem_6rem] md:items-center">
        <div>
          <h3 class="text-subtitle">
            {{ t("operations.turnaround") }}
          </h3>
          <p class="mt-1 text-caption text-text-muted">
            {{ t("operations.visualEditor.dragHint") }}
          </p>
        </div>
        <input
          class="w-full accent-primary"
          max="240"
          min="45"
          step="15"
          type="range"
          :value="turnaroundMinutes"
          @input="emit('update-turnaround-minutes', Number(($event.target as HTMLInputElement).value))"
        />
        <input
          class="w-full rounded-lg border border-border bg-background px-3 py-2 text-body"
          max="240"
          min="45"
          step="15"
          type="number"
          :value="turnaroundMinutes"
          @input="emit('update-turnaround-minutes', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>
  </section>
</template>
