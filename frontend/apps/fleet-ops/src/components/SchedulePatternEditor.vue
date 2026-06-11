<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirSegmentedControl, type AirSegmentedControlOption, AirSelect } from "@airlinesim/air-ui";

defineProps<{
  appLocale: Locale;
  days: number[];
  departureTime: string;
  frequencyLabel: string;
  frequencyMode: string;
  frequencyOptions: AirSegmentedControlOption[];
  t: (key: string) => string;
  timeOptions: Array<{ label: string; value: string }>;
  turnaroundMinutes: number;
  weekdayOrder: number[];
}>();

const emit = defineEmits<{
  "select-frequency": [value: string];
  "toggle-day": [day: number];
  "update-departure-time": [value: string];
  "update-turnaround-minutes": [value: number];
}>();

function dayLabel(locale: Locale, day: number): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(Date.UTC(2024, 0, 7 + day)));
}

function isDaySelected(days: number[], day: number): boolean {
  return days.includes(day);
}
</script>

<template>
  <div class="grid min-w-0 content-start gap-4">
    <div class="rounded-lg border border-border bg-surface p-4">
      <div class="mt-0 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <p class="mb-2 text-caption text-text-muted">
            {{ frequencyLabel }}
          </p>
          <AirSegmentedControl
            :label="frequencyLabel"
            :model-value="frequencyMode"
            :options="frequencyOptions"
            @select="emit('select-frequency', $event)"
          />
        </div>
        <AirSelect
          :model-value="departureTime"
          :label="t('operations.time')"
          :options="timeOptions"
          @update:model-value="emit('update-departure-time', $event)"
        />
      </div>
    </div>

    <div class="rounded-lg border border-border bg-surface p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-subtitle">
            {{ t("operations.days.title") }}
          </h2>
          <p class="mt-1 text-caption text-text-muted">
            {{ t("operations.days.subtitle") }}
          </p>
        </div>
        <span class="text-caption text-text-muted">
          {{ days.length }} x {{ t("operations.roundTrip") }}
        </span>
      </div>
      <div class="mt-4 grid grid-cols-7 gap-2">
        <button
          v-for="day in weekdayOrder"
          :key="day"
          class="min-h-14 rounded-lg border px-2 py-2 text-caption font-medium capitalize transition"
          :class="isDaySelected(days, day) ? 'border-primary bg-primary text-on-primary' : 'border-border bg-background text-text-muted hover:bg-surface-subtle'"
          type="button"
          @click="emit('toggle-day', day)"
        >
          {{ dayLabel(appLocale, day) }}
        </button>
      </div>
    </div>

    <div class="rounded-lg border border-border bg-surface p-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 class="text-subtitle">
            {{ t("operations.turnaround") }}
          </h2>
          <p class="mt-1 text-caption text-text-muted">
            {{ t("operations.turnaround.visualHint") }}
          </p>
        </div>
        <AirBadge
          :label="`${turnaroundMinutes} ${t('unit.minuteShort')}`"
          variant="warning-soft"
        />
      </div>
      <input
        class="mt-4 w-full accent-primary"
        max="240"
        min="45"
        step="15"
        type="range"
        :value="turnaroundMinutes"
        @input="emit('update-turnaround-minutes', Number(($event.target as HTMLInputElement).value))"
      />
      <div class="mt-2 flex justify-between text-caption text-text-muted">
        <span>45</span>
        <span>120</span>
        <span>240</span>
      </div>
    </div>
  </div>
</template>
