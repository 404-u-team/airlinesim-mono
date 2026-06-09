<script setup lang="ts">
import { AirButton, AirMetricCard } from "@airlinesim/air-ui";

import type { OperationAircraftOption, OperationReason, SchedulePreviewResponse } from "../types";

defineProps<{
  canActivate: boolean;
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  isSaving: boolean;
  preview: null | SchedulePreviewResponse["preview"];
  reasonLabel: (reason: OperationReason) => string;
  routeLabel: string;
  selectedAircraft: null | OperationAircraftOption;
  t: (key: string) => string;
}>();

const emit = defineEmits<{
  activate: [];
}>();
</script>

<template>
  <aside class="grid min-w-0 content-start gap-4">
    <section class="rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ t("operations.preview") }}
      </h2>
      <p class="mt-1 text-caption text-text-muted">
        {{ routeLabel || t("operations.selectRoute") }}
      </p>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <AirMetricCard
          :label="t('operations.weeklyRevenue')"
          :value="formatMoney(preview?.economics.weekly_revenue)"
        />
        <AirMetricCard
          :label="t('operations.weeklyCost')"
          :value="formatMoney(preview?.economics.weekly_cost)"
        />
        <AirMetricCard
          :label="t('operations.weeklyProfit')"
          :tone="(preview?.economics.weekly_profit ?? 0) > 0 ? 'success' : 'warning'"
          :value="formatMoney(preview?.economics.weekly_profit)"
        />
        <AirMetricCard
          :label="t('operations.utilization')"
          :value="`${formatNumber(preview?.weekly_utilization_hours)} ${t('unit.hourShort')}`"
        />
      </div>
    </section>

    <section class="rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ t("operations.aircraft.ready") }}
      </h2>
      <p class="mt-2 text-body text-text-muted">
        {{ selectedAircraft?.aircraft.tail_number ?? "-" }} · {{ selectedAircraft?.aircraft.modelName ?? "-" }}
      </p>
      <div
        v-if="selectedAircraft?.blockers.length || selectedAircraft?.warnings.length"
        class="mt-3 grid gap-2"
      >
        <p
          v-for="reason in [...(selectedAircraft?.blockers ?? []), ...(selectedAircraft?.warnings ?? [])]"
          :key="reason.code"
          class="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-caption text-warning"
        >
          {{ reasonLabel(reason) }}
        </p>
      </div>
    </section>

    <section
      v-if="preview?.blockers.length || preview?.warnings.length"
      class="grid gap-2"
    >
      <p
        v-for="reason in [...(preview?.blockers ?? []), ...(preview?.warnings ?? [])]"
        :key="reason.code"
        class="rounded-lg border px-3 py-2 text-caption"
        :class="preview?.blockers.includes(reason) ? 'border-error bg-error-bg text-error' : 'border-warning bg-warning-bg text-warning'"
      >
        {{ reasonLabel(reason) }}
      </p>
    </section>

    <AirButton
      class="w-full"
      :disabled="!canActivate || isSaving"
      :label="isSaving ? t('operations.activating') : t('action.activateSchedule')"
      @click="emit('activate')"
    />
  </aside>
</template>
