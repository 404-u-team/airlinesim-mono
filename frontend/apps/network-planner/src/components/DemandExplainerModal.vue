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

const rows = computed<Array<{ highlight?: boolean; label: string; value: string }>>(() => {
  const data = breakdown.value;

  if (!data) {
    return [];
  }

  return [
    { label: props.t("demand.population"), value: `${props.formatNumber(data.originPopulation)} / ${props.formatNumber(data.destinationPopulation)}` },
    { label: props.t("demand.gdp"), value: `${props.formatMoney(data.originGdpPerCapita)} / ${props.formatMoney(data.destinationGdpPerCapita)}` },
    { label: props.t("demand.distanceImpedance"), value: `${props.formatNumber(props.demand.distance_km)} ${props.t("metric.km")} → ×${formatFactor(data.distanceImpedance)}` },
    { label: props.t("demand.gravity"), value: `×${formatFactor(data.gravity)}` },
    { label: props.t("demand.airportFactor"), value: `×${formatFactor(data.airportFactor)}` },
    { label: props.t("demand.affinity"), value: `×${formatFactor(data.affinityFactor)} (${formatFactor(data.business)} / ${formatFactor(data.tourism)} / ${formatFactor(data.diaspora)})` },
    { label: props.t("demand.sameCountry"), value: data.sameCountry ? props.t("demand.yes") : props.t("demand.no") },
    { label: props.t("demand.baseDemand"), value: props.formatNumber(data.baseDemand) },
    { label: props.t("demand.directionFactor"), value: `×${formatFactor(data.directionFactorOriginToDestination)}` },
    { highlight: true, label: props.t("demand.calibrationK"), value: formatFactor(data.calibrationK) },
  ];
});

function formatFactor(value: number): string {
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
        class="flex items-center gap-2"
      >
        <span class="text-caption text-text-muted">{{ t("demand.source") }}:</span>
        <AirBadge
          :label="breakdown.source === 'region_link' ? t('demand.source.region_link') : t('demand.source.model')"
          :variant="breakdown.source === 'region_link' ? 'primary-soft' : 'success-soft'"
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
            :class="row.highlight ? 'border-warning bg-warning-bg text-warning' : ''"
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

      <p class="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-caption text-warning">
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
