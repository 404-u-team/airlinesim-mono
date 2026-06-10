<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";

import type { SegmentRow } from "../types";

const props = defineProps<{ appLocale: Locale; segments: SegmentRow[] }>();

const groups = computed<{ label: string; rows: SegmentRow[] }[]>(() => {
  const ru = props.appLocale === "ru";
  return [
    { label: ru ? "По факт. потоку" : "By real traffic", rows: props.segments.filter((s) => s.group === "realDaily") },
    { label: ru ? "По силе аэропортов" : "By airport strength", rows: props.segments.filter((s) => s.group === "strength") },
    { label: ru ? "По расстоянию" : "By distance", rows: props.segments.filter((s) => s.group === "distance") },
  ];
});

function onTarget(ratio: number): boolean {
  return ratio >= 0.7 && ratio <= 1.5;
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-3">
    <div v-for="group in groups" :key="group.label" class="rounded-md border border-border overflow-hidden">
      <div class="bg-surface-subtle px-3 py-2 text-caption font-semibold uppercase text-text-muted">
        {{ group.label }}
      </div>
      <table class="w-full text-caption">
        <thead class="text-text-muted">
          <tr class="border-b border-border">
            <th class="px-3 py-1.5 text-left font-medium">
              {{ appLocale === 'ru' ? 'Сегмент' : 'Segment' }}
            </th>
            <th class="px-2 py-1.5 text-right font-medium" :title="appLocale === 'ru' ? 'кол-во пар' : 'pairs'">
              n
            </th>
            <th class="px-2 py-1.5 text-right font-medium">
              med
            </th>
            <th class="px-2 py-1.5 text-right font-medium">
              avg
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in group.rows" :key="row.key" class="border-b border-border last:border-0">
            <td class="px-3 py-1.5">
              {{ row.label }}
            </td>
            <td class="px-2 py-1.5 text-right font-mono">
              {{ row.count }}
            </td>
            <td
              class="px-2 py-1.5 text-right font-mono font-semibold"
              :class="onTarget(row.medianRatio) ? 'text-success' : 'text-warning'"
            >
              ×{{ row.medianRatio.toFixed(1) }}
            </td>
            <td class="px-2 py-1.5 text-right font-mono text-text-muted">
              ×{{ row.meanRatio.toFixed(1) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
