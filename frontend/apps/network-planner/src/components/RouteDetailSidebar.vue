<script setup lang="ts">
import { AirButton, AirStatePanel } from "@airlinesim/air-ui";

import type { NetworkMessageKey } from "../i18n";
import type { PriceAnalysisResponse, RouteDetailSchedule } from "../types";

defineProps<{
  analysis: null | PriceAnalysisResponse["analysis"];
  analysisError: string;
  fareOutbound: string;
  fareReturn: string;
  formatMoney: (value: number | undefined) => string;
  isAnalyzing: boolean;
  isSaving: boolean;
  schedules: RouteDetailSchedule[];
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  "analyze": [];
  "apply": [];
  "save": [];
  "update:fare-outbound": [value: string];
  "update:fare-return": [value: string];
}>();

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function dayLabels(days: number[]): string {
  return days.map((day) => DAY_LABELS[day] ?? String(day)).join(" ");
}
</script>

<template>
  <aside class="grid h-max gap-3">
    <div class="rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ t("detail.price.title") }}
      </h2>
      <p class="mt-0.5 text-caption text-text-muted">
        {{ t("detail.price.hint") }}
      </p>
      <div class="mt-3 grid gap-2">
        <label class="grid gap-1 text-caption text-text-muted">
          {{ t("price.outbound") }}
          <input
            class="rounded-md border border-border bg-background px-2 py-1 text-body text-text-primary"
            inputmode="numeric"
            min="0"
            :placeholder="t('price.auto')"
            type="number"
            :value="fareOutbound"
            @input="emit('update:fare-outbound', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="grid gap-1 text-caption text-text-muted">
          {{ t("price.return") }}
          <input
            class="rounded-md border border-border bg-background px-2 py-1 text-body text-text-primary"
            inputmode="numeric"
            min="0"
            :placeholder="t('price.auto')"
            type="number"
            :value="fareReturn"
            @input="emit('update:fare-return', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
      <AirButton
        class="mt-3 w-full"
        :disabled="isSaving"
        :label="isSaving ? '...' : t('detail.price.save')"
        variant="primary"
        @click="emit('save')"
      />
    </div>

    <div class="rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ t("detail.analysis.title") }}
      </h2>
      <p class="mt-0.5 text-caption text-text-muted">
        {{ t("detail.analysis.hint") }}
      </p>
      <AirStatePanel
        v-if="analysisError"
        class="mt-2"
        :body="analysisError"
        :title="t('detail.analysis.error')"
        tone="danger"
      />
      <div
        v-if="analysis"
        class="mt-2 grid gap-2"
      >
        <div class="rounded-md border border-border bg-background px-3 py-2">
          <p class="text-caption text-text-muted">
            {{ t("price.outbound") }}
          </p>
          <p class="text-subtitle">
            {{ formatMoney(analysis.outbound.suggested_fare) }}
            <span class="text-caption text-text-muted">· {{ formatMoney(analysis.outbound.projected_profit_per_flight) }}/{{ t("detail.analysis.perFlight") }}</span>
          </p>
          <p class="mt-0.5 text-caption text-success">
            +{{ formatMoney(analysis.outbound.uplift_per_flight) }} {{ t("detail.analysis.uplift") }}
          </p>
        </div>
        <div class="rounded-md border border-border bg-background px-3 py-2">
          <p class="text-caption text-text-muted">
            {{ t("price.return") }}
          </p>
          <p class="text-subtitle">
            {{ formatMoney(analysis.return.suggested_fare) }}
            <span class="text-caption text-text-muted">· {{ formatMoney(analysis.return.projected_profit_per_flight) }}/{{ t("detail.analysis.perFlight") }}</span>
          </p>
          <p class="mt-0.5 text-caption text-success">
            +{{ formatMoney(analysis.return.uplift_per_flight) }} {{ t("detail.analysis.uplift") }}
          </p>
        </div>
        <AirButton
          :label="t('detail.analysis.apply')"
          size="sm"
          variant="success-soft"
          @click="emit('apply')"
        />
      </div>
      <AirButton
        class="mt-3 w-full"
        :disabled="isAnalyzing"
        :label="isAnalyzing ? '...' : analysis ? `${t('detail.analysis.run')} · ${formatMoney(analysis.fee)}` : `${t('detail.analysis.run')} · ${t('detail.analysis.feeFrom')} ${formatMoney(50000)}`"
        variant="warning"
        @click="emit('analyze')"
      />
    </div>

    <div class="rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ t("detail.schedules.title") }}
      </h2>
      <p
        v-if="schedules.length === 0"
        class="mt-2 text-caption text-text-muted"
      >
        {{ t("detail.schedules.empty") }}
      </p>
      <ul
        v-else
        class="mt-2 grid gap-2"
      >
        <li
          v-for="schedule in schedules"
          :key="schedule.id"
          class="rounded-md border border-border bg-background px-3 py-2"
        >
          <p class="text-body">
            {{ dayLabels(schedule.pattern.days_of_week) }} · {{ schedule.pattern.departure_local_time }}
          </p>
          <p class="text-caption text-text-muted">
            {{ t(`status.${schedule.status}` as NetworkMessageKey) || schedule.status }}
          </p>
        </li>
      </ul>
    </div>
  </aside>
</template>
