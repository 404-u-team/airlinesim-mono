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
    { label: props.t("demand.groundCompetition"), value: `×${factor(data.groundCompetition)}` },
    { label: props.t("demand.baseDemand"), value: props.formatNumber(data.baseDemand) },
    { label: props.t("demand.directionFactor"), value: `×${factor(data.directionFactorOriginToDestination)}` },
    { label: props.t("demand.directionFactorReturn"), value: `×${factor(data.directionFactorDestinationToOrigin)}` },
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
    <div class="grid gap-5">
      <!-- Intro description -->
      <p class="text-sm leading-relaxed text-text-muted">
        {{ t("demand.intro") }}
      </p>

      <!-- Source badges -->
      <div
        v-if="breakdown"
        class="flex flex-wrap items-center gap-2"
      >
        <span class="text-[0.7rem] font-semibold uppercase tracking-wide text-text-muted">{{ t("demand.source") }}</span>
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

      <!-- Equation Block (HTML/CSS typesetting) -->
      <section class="rounded-xl border border-border/80 bg-background/30 p-4 shadow-sm">
        <h3 class="mb-4 text-sm font-bold text-text-primary">
          {{ t("demand.section.formula") }}
        </h3>
        <div class="math-block">
          <!-- Step 1: gravity mass -->
          <div class="math-row">
            <span class="math-lhs text-primary">G</span>
            <span class="math-eq">=</span>
            <span class="math-rhs">
              <span class="math-term text-amber-500 font-semibold">baseScale</span>
              <span class="math-op">&middot;</span>
              <span class="math-term">catch<sub>O</sub><sup>&alpha;</sup></span>
              <span class="math-op">&middot;</span>
              <span class="math-term">catch<sub>D</sub><sup>&alpha;</sup></span>
              <span class="math-op">&middot;</span>
              <span class="math-term">GDPpc<sub>O</sub><sup>&beta;</sup></span>
              <span class="math-op">&middot;</span>
              <span class="math-term">GDPpc<sub>D</sub><sup>&beta;</sup></span>
              <span class="math-op">&middot;</span>
              <span class="math-term">D(dist)</span>
            </span>
          </div>

          <!-- Step 2: base demand -->
          <div class="math-row">
            <span class="math-lhs text-primary">BaseDemand</span>
            <span class="math-eq">=</span>
            <span class="math-rhs">
              <span class="math-term">G</span>
              <span class="math-op">&middot;</span>
              <span class="math-sqrt">
                <span class="math-radical">&radic;</span>
                <span class="math-radicand">prop<sub>O</sub> &middot; prop<sub>D</sub></span>
              </span>
              <span class="math-op">&middot;</span>
              <span class="math-term">affinity</span>
              <span class="math-op">&middot;</span>
              <span class="math-term">shortHaul</span>
            </span>
          </div>

          <!-- Step 3: daily demand -->
          <div class="math-row">
            <span class="math-lhs text-primary">DailyDemand</span>
            <span class="math-eq">=</span>
            <span class="math-rhs">
              <span class="math-term">BaseDemand</span>
              <span class="math-op">&middot;</span>
              <span class="math-term">direction</span>
              <span class="math-op">&middot;</span>
              <span class="math-term">airportShare</span>
              <span class="math-op">&middot;</span>
              <span class="math-term">override</span>
            </span>
          </div>
        </div>
      </section>

      <!-- Factors Grid and Results Dashboard -->
      <section v-if="rows.length">
        <h3 class="text-sm font-bold text-text-primary mb-3">
          {{ t("demand.section.factors") }}
        </h3>
        
        <!-- Two-column grid of parameters -->
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div
            v-for="row in rows"
            :key="row.label"
            class="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/30 px-3 py-2 text-sm transition-all hover:bg-background/80"
            :class="{
              'border-warning/60 bg-warning-bg/40 text-warning font-medium': row.highlight === 'knob',
              'border-primary/60 bg-primary-soft/40 text-on-primary-soft font-medium': row.highlight === 'override',
            }"
          >
            <dt class="min-w-0 text-text-muted text-xs">
              {{ row.label }}
            </dt>
            <dd class="shrink-0 font-mono font-semibold">
              {{ row.value }}
            </dd>
          </div>
        </dl>

        <!-- Dynamic Results Panel (3-column layout) -->
        <div class="mt-4 rounded-xl border border-primary/20 bg-primary-soft/10 p-4">
          <h4 class="text-xs font-bold uppercase tracking-wider text-primary mb-3">
            {{ t("demand.result") }}
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <!-- Outbound passengers card -->
            <div class="rounded-lg bg-background/60 p-3 border border-border flex flex-col justify-between shadow-sm">
              <span class="text-xs text-text-muted mb-1 block">{{ t("demand.result.outbound") }}</span>
              <span class="text-lg font-bold font-mono text-text-primary">
                {{ formatNumber(demand.origin_daily_passengers) }}
                <span class="text-xs font-normal text-text-muted">{{ t("metric.paxPerDay") }}</span>
              </span>
            </div>
            <!-- Return passengers card -->
            <div class="rounded-lg bg-background/60 p-3 border border-border flex flex-col justify-between shadow-sm">
              <span class="text-xs text-text-muted mb-1 block">{{ t("demand.result.return") }}</span>
              <span class="text-lg font-bold font-mono text-text-primary">
                {{ formatNumber(demand.destination_daily_passengers) }}
                <span class="text-xs font-normal text-text-muted">{{ t("metric.paxPerDay") }}</span>
              </span>
            </div>
            <!-- Average passenger card (main highlighted) -->
            <div class="rounded-lg bg-primary/20 p-3 border border-primary/30 flex flex-col justify-between shadow-sm">
              <span class="text-xs text-primary font-semibold mb-1 block">{{ t("demand.result.average") }}</span>
              <span class="text-xl font-extrabold font-mono text-primary">
                {{ formatNumber(Math.round((demand.origin_daily_passengers + demand.destination_daily_passengers) / 2)) }}
                <span class="text-xs font-normal text-primary/80">{{ t("metric.paxPerDay") }}</span>
              </span>
            </div>
          </div>
          <p class="mt-3 text-xs text-text-muted leading-relaxed">
            {{ t("demand.averageNote") }}
          </p>
        </div>
      </section>

      <!-- Calibration warning if uncalibrated -->
      <p
        v-if="isUncalibrated"
        class="rounded-lg border border-warning/60 bg-warning-bg/40 px-3.5 py-2.5 text-xs text-warning leading-relaxed"
      >
        {{ t("demand.calibrationNote") }}
      </p>

      <!-- Load calculation explanation -->
      <section class="border-t border-border/60 pt-4">
        <h3 class="text-sm font-bold text-text-primary">
          {{ t("demand.load.title") }}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-text-muted">
          {{ t("demand.load.body") }}
        </p>
      </section>
    </div>
  </AirModal>
</template>

<style scoped>
/* Aligned three-column equation layout: [lhs] = [rhs] */
.math-block {
  display: grid;
  grid-template-columns: max-content max-content 1fr;
  align-items: baseline;
  column-gap: 0.65rem;
  row-gap: 0.9rem;
  font-family: var(--font-source-code), monospace;
  font-size: 0.8125rem;
}

.math-row {
  display: contents;
}

.math-row + .math-row .math-lhs,
.math-row + .math-row .math-eq,
.math-row + .math-row .math-rhs {
  border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  padding-top: 0.9rem;
}

.math-lhs {
  justify-self: end;
  font-weight: 700;
  white-space: nowrap;
}

.math-eq {
  color: var(--text-muted);
  font-family: var(--font-montserrat), sans-serif;
}

.math-rhs {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.3rem 0.4rem;
  line-height: 1.6;
}

.math-op {
  color: var(--text-muted);
}

.math-term sub,
.math-radicand sub {
  font-size: 0.7em;
  vertical-align: sub;
}

.math-term sup {
  font-size: 0.7em;
  vertical-align: super;
}

/* Square root with proper overline over the radicand */
.math-sqrt {
  display: inline-flex;
  align-items: stretch;
}

.math-radical {
  font-size: 1.2em;
  line-height: 1;
  transform: translateY(-0.04em);
}

.math-radicand {
  border-top: 1.5px solid currentColor;
  padding: 0.12em 0.3em 0;
  margin-left: 0.05em;
}

@media (min-width: 768px) {
  .math-block {
    font-size: 0.875rem;
  }
}
</style>
