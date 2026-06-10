<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import type { ScorecardRow } from "../types";

import { adminCalibrationMessages } from "../i18n";

const props = defineProps<{
  appLocale: Locale;
  scorecard: ScorecardRow[];
}>();

const t = (key: keyof typeof adminCalibrationMessages.en) =>
  adminCalibrationMessages[props.appLocale][key];

function getDeviationClass(pct: number): string {
  const absPct = Math.abs(pct);
  if (absPct < 15) {
    return "text-success bg-success-bg/20 border-success/30";
  }
  if (absPct < 35) {
    return "text-warning bg-warning-bg/20 border-warning/30";
  }
  return "text-danger bg-error-bg/20 border-danger/30";
}
</script>

<template>
  <div class="overflow-x-auto max-h-[450px] overflow-y-auto border border-border rounded-md">
    <table class="w-full border-collapse text-left text-body">
      <thead class="sticky top-0 bg-surface border-b border-border z-10">
        <tr class="text-text-muted text-caption uppercase">
          <th class="py-2.5 px-3">
            {{ t("origin") }}
          </th>
          <th class="py-2.5 px-3">
            {{ t("destination") }}
          </th>
          <th class="py-2.5 px-3 text-right">
            {{ t("realPax") }}
          </th>
          <th class="py-2.5 px-3 text-right">
            {{ t("modelPax") }}
          </th>
          <th class="py-2.5 px-3 text-center">
            {{ t("deviation") }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <tr
          v-for="row in scorecard.slice(0, 150)"
          :key="`${row.originIata}-${row.destIata}`"
          class="hover:bg-surface-subtle/40 transition-colors"
        >
          <td class="py-2 px-3 font-semibold text-text-primary">
            {{ row.originIata }}
          </td>
          <td class="py-2 px-3 font-semibold text-text-primary">
            {{ row.destIata }}
          </td>
          <td class="py-2 px-3 text-right font-mono">
            {{ row.realDailyPax }}
          </td>
          <td class="py-2 px-3 text-right font-mono">
            {{ row.modelDailyPax }}
          </td>
          <td class="py-2 px-3 text-center">
            <span
              class="inline-block px-2 py-0.5 rounded text-caption font-bold border"
              :class="getDeviationClass(row.errorPct)"
            >
              {{ row.errorPct > 0 ? '+' : '' }}{{ row.errorPct }}%
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
