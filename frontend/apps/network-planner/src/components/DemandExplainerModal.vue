<script setup lang="ts">
import { AirBadge, AirModal } from "@airlinesim/air-ui";
import { computed } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type { RouteDemandSnapshot } from "../types";

const props = defineProps<{
  demand: RouteDemandSnapshot;
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  open: boolean;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const breakdown = computed(() => props.demand.breakdown ?? null);

const hasMetroSplit = computed(() => {
  const data = breakdown.value;
  return data != null && data.capacityShareFactor < 0.999;
});

const hasOverride = computed(() => {
  const data = breakdown.value;
  return data != null && Math.abs(data.overrideMultiplier - 1) > 1e-6;
});

// Whether the absolute level is still uncalibrated (per-country propensity = 1).
const isUncalibrated = computed(() => {
  const data = breakdown.value;
  return data != null && Math.abs(data.propensityFactor - 1) < 1e-6;
});

type Row = { highlight?: "knob" | "override"; label: string; value: string };

const rows = computed<Row[]>(() => {
  const data = breakdown.value;
  if (!data) {
    return [];
  }

  const result: Row[] = [
    { label: props.t("demand.catchment"), value: `${props.formatNumber(data.originCatchment)} / ${props.formatNumber(data.destinationCatchment)}` },
    { label: props.t("demand.gdp"), value: `${props.formatMoney(data.originGdpPerCapita)} / ${props.formatMoney(data.destinationGdpPerCapita)}` },
    { label: props.t("demand.market"), value: `${data.originMarketKey} / ${data.destinationMarketKey}` },
    { label: props.t("demand.distanceImpedance"), value: `${props.formatNumber(props.demand.distance_km)} ${props.t("metric.km")} → ×${factor(data.distanceImpedance)}` },
    { label: props.t("demand.gravity"), value: `×${factor(data.gravity)}` },
    { label: props.t("demand.propensity"), value: `×${factor(data.propensityFactor)} (${factor(data.originPropensity)} / ${factor(data.destinationPropensity)})` },
    { label: props.t("demand.affinity"), value: `×${factor(data.affinityFactor)} (${factor(data.business)} / ${factor(data.tourism)} / ${factor(data.diaspora)})` },
    { label: props.t("demand.sameCountry"), value: data.sameCountry ? props.t("demand.yes") : props.t("demand.no") },
    { label: props.t("demand.shortHaul"), value: `×${factor(data.shortHaulFactor)}` },
    { label: props.t("demand.baseDemand"), value: props.formatNumber(data.baseDemand) },
    { label: props.t("demand.directionFactor"), value: `×${factor(data.directionFactorOriginToDestination)}` },
  ];

  if (hasMetroSplit.value) {
    result.push({ label: props.t("demand.capacityShare"), value: `×${factor(data.capacityShareFactor)}` });
  }
  if (hasOverride.value) {
    result.push({ highlight: "override", label: props.t("demand.override"), value: `×${factor(data.overrideMultiplier)}` });
  }

  result.push({ highlight: "knob", label: props.t("demand.baseScale"), value: factor(data.baseScale) });

  return result;
});

function factor(value: number): string {
  return value.toFixed(2);
}
</script>

<template>
  <AirModal
    :close-label="t('demand.close')"
    :open="open"
    size="lg"
    :title="t('demand.title')"
    @close="emit('close')"
  >
    <div class="grid gap-4">
      <p class="text-body text-text-muted">
        {{ t("demand.intro") }}
      </p>

      <div
        v-if="breakdown"
        class="flex flex-wrap items-center gap-2"
      >
        <span class="text-caption text-text-muted">{{ t("demand.source") }}:</span>
        <AirBadge
          :label="breakdown.catchmentSource === 'artifact' ? t('demand.source.artifact') : t('demand.source.fallback')"
          :variant="breakdown.catchmentSource === 'artifact' ? 'success-soft' : 'warning-soft'"
        />
        <AirBadge
          v-if="hasOverride"
          :label="t('demand.source.override')"
          variant="primary-soft"
        />
      </div>

      <section>
        <h3 class="text-subtitle">
          {{ t("demand.section.formula") }}
        </h3>
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-2 text-caption text-text-primary">{{ t("demand.formula") }}</pre>
      </section>

      <section v-if="rows.length">
        <h3 class="text-subtitle">
          {{ t("demand.section.factors") }}
        </h3>
        <dl class="mt-2 grid gap-1.5">
          <div
            v-for="row in rows"
            :key="row.label"
            class="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
            :class="{
              'border-warning bg-warning-bg text-warning': row.highlight === 'knob',
              'border-primary bg-primary-soft text-on-primary-soft': row.highlight === 'override',
            }"
          >
            <dt class="min-w-0 text-caption text-text-muted">
              {{ row.label }}
            </dt>
            <dd class="shrink-0 text-body font-semibold">
              {{ row.value }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3 rounded-md border border-primary bg-primary-soft px-3 py-2 text-on-primary-soft">
            <dt class="min-w-0 text-caption">
              {{ t("demand.result") }}
            </dt>
            <dd class="shrink-0 text-subtitle font-semibold">
              {{ formatNumber(demand.origin_daily_passengers) }} {{ t("metric.paxPerDay") }}
            </dd>
          </div>
        </dl>
      </section>

      <p
        v-if="isUncalibrated"
        class="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-caption text-warning"
      >
        {{ t("demand.calibrationNote") }}
      </p>

      <section>
        <h3 class="text-subtitle">
          {{ t("demand.load.title") }}
        </h3>
        <p class="mt-2 text-body text-text-muted">
          {{ t("demand.load.body") }}
        </p>
      </section>
    </div>
  </AirModal>
</template>
