<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import type { FacilitiesOverview } from "../types";

import { type FacilitiesMessageKey, t } from "../i18n";

const props = defineProps<{
  locale: Locale;
  slots: FacilitiesOverview["slots"];
}>();
const dayNames = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
};

function message(key: FacilitiesMessageKey): string {
  return t(props.locale, key);
}

function percent(value: number): string {
  return new Intl.NumberFormat(props.locale, { maximumFractionDigits: 0, style: "percent" }).format(value);
}
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-subtitle">
      {{ message("slots.title") }}
    </h2>
    <p class="mt-1 text-body text-text-muted">
      {{ message("slots.description") }}
    </p>
    <div class="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
      <article
        v-for="day in slots.days"
        :key="day.day"
        class="rounded-lg border border-border p-3"
        :class="{ 'border-error bg-error-bg': day.utilization > 1, 'border-warning bg-warning-bg': day.utilization >= 0.8 && day.utilization <= 1 }"
      >
        <div class="flex items-center justify-between gap-2">
          <strong>{{ dayNames[locale][day.day] }}</strong>
          <span class="text-caption text-text-muted">{{ percent(day.utilization) }}</span>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
          <div
            class="h-full rounded-full bg-primary"
            :style="{ width: `${Math.min(day.utilization * 100, 100)}%` }"
          />
        </div>
        <p class="mt-2 text-caption text-text-muted">
          {{ message("slots.current") }} {{ day.current }} / {{ day.capacity }}
        </p>
        <p class="text-caption text-text-muted">
          {{ message("slots.remaining") }} {{ day.remaining }}
        </p>
      </article>
    </div>
  </section>
</template>

