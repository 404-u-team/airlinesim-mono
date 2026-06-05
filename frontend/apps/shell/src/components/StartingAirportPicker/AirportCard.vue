<script setup lang="ts">
import { type Locale, translate } from "@airlinesim/i18n";
import { computed } from "vue";

import { type ShellMessageKey, shellMessages } from "../../i18n/messages";
import WarningBadge from "./WarningBadge.vue";

type OnboardingAirportOption = {
  country_id?: string;
  country_name?: string;
  fuel_price_multiplier?: number;
  gate_fee?: number;
  iata_code?: string;
  icao_code?: string;
  id: string;
  intl_name?: string;
  local_name?: string;
  max_runway_length_m?: number;
  max_runway_uses_per_day?: number;
  municipality?: string;
  region_id?: string;
  runway_fee?: number;
  score: number;
  stand_fee?: number;
  warnings: string[];
  works_at_night?: boolean;
};

const props = withDefaults(
  defineProps<{
    airport: OnboardingAirportOption;
    appLocale: Locale;
    variant?: "compact" | "detailed";
  }>(),
  {
    variant: "compact",
  },
);


const isSuitable = computed(() => props.airport.score >= 1000 && !props.airport.warnings.includes("SHORT_RUNWAY"));
const locationLabel = computed(() =>
  [props.airport.municipality, props.airport.country_name].filter(Boolean).join(", "),
);
const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

const totalFees = computed(() => {
  const gate = props.airport.gate_fee ?? 0;
  const stand = props.airport.stand_fee ?? 0;
  const runway = props.airport.runway_fee ?? 0;
  return gate + stand + runway;
});
</script>

<template>
  <!-- Compact Option for Dropdown -->
  <div
    v-if="variant === 'compact'"
    class="flex items-center justify-between p-3 gap-4"
  >
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-caption font-semibold text-primary">
          {{ airport.iata_code || airport.icao_code || '---' }}
        </span>
        <span class="font-medium text-body text-text-primary truncate">
          {{ airport.intl_name || airport.local_name || 'Airport' }}
        </span>
        <span
          v-if="airport.municipality"
          class="text-caption text-text-muted truncate"
        >
          ({{ airport.municipality }})
        </span>
      </div>
      <div class="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-caption text-text-muted">
        <span>{{ t("onboarding.airport.runway") }}: {{ airport.max_runway_length_m }} {{ t("unit.meterShort") }}</span>
        <span>•</span>
        <span>{{ t("onboarding.airport.slots") }}: {{ airport.max_runway_uses_per_day }}</span>
        <span>•</span>
        <span>{{ t("onboarding.airport.nightOpsShort") }}: {{ airport.works_at_night ? t("common.yes") : t("common.no") }}</span>
      </div>
    </div>

    <!-- Score Badge -->
    <div class="flex flex-col items-end gap-1">
      <span
        class="inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium"
        :class="airport.score >= 1000 ? 'bg-success/15 text-success' : 'bg-text-muted/10 text-text-muted'"
      >
        {{ t("onboarding.airport.score") }}: {{ airport.score }}
      </span>
      <div
        v-if="airport.warnings.length > 0"
        class="flex gap-1"
      >
        <span class="h-2 w-2 rounded-full bg-error" />
      </div>
    </div>
  </div>

  <!-- Detailed Selected Card -->
  <div
    v-else
    class="rounded-xl border border-border bg-surface-subtle p-5 space-y-4"
  >
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1 text-body font-bold text-primary">
            {{ airport.iata_code || airport.icao_code || '---' }}
          </span>
          <h3 class="text-subtitle font-bold text-text-primary">
            {{ airport.intl_name || airport.local_name || 'Airport' }}
          </h3>
        </div>
        <p
          v-if="airport.municipality"
          class="mt-1 text-body text-text-muted"
        >
          {{ locationLabel }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <div class="text-right">
          <span class="text-caption text-text-muted">{{ t("onboarding.airport.startingRating") }}</span>
          <div
            class="text-subtitle font-black"
            :class="isSuitable ? 'text-success' : 'text-warning'"
          >
            {{ airport.score }}
          </div>
        </div>
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
      <div class="rounded-lg border border-border bg-surface p-3">
        <span class="text-caption text-text-muted block">{{ t("onboarding.airport.runway") }}</span>
        <span class="text-body font-semibold text-text-primary">{{ airport.max_runway_length_m }} {{ t("unit.meterShort") }}</span>
      </div>
      <div class="rounded-lg border border-border bg-surface p-3">
        <span class="text-caption text-text-muted block">{{ t("onboarding.airport.slotsLimit") }}</span>
        <span class="text-body font-semibold text-text-primary">{{ airport.max_runway_uses_per_day }} / {{ t("unit.dayShort") }}</span>
      </div>
      <div class="rounded-lg border border-border bg-surface p-3">
        <span class="text-caption text-text-muted block">{{ t("onboarding.airport.nightOperations") }}</span>
        <span class="text-body font-semibold text-text-primary">
          {{ airport.works_at_night ? t("onboarding.airport.allowed") : t("onboarding.airport.prohibited") }}
        </span>
      </div>
      <div class="rounded-lg border border-border bg-surface p-3">
        <span class="text-caption text-text-muted block">{{ t("onboarding.airport.totalFees") }}</span>
        <span class="text-body font-semibold text-text-primary">${{ totalFees }}</span>
      </div>
    </div>

    <!-- Warnings -->
    <div
      v-if="airport.warnings.length > 0"
      class="space-y-1.5"
    >
      <span class="text-caption font-semibold text-text-muted block">{{ t("onboarding.airport.operationalConstraints") }}</span>
      <div class="flex flex-wrap gap-2">
        <WarningBadge
          v-for="warning in airport.warnings"
          :key="warning"
          :warning="warning"
          :app-locale="appLocale"
        />
      </div>
    </div>

    <!-- Suitability Tips -->
    <div class="border-t border-border pt-4">
      <div
        v-if="isSuitable"
        class="rounded-lg bg-success/10 p-3 text-body text-success flex items-start gap-3"
      >
        <span
          class="font-bold"
          aria-hidden="true"
        >+</span>
        <div>
          <span class="font-semibold block">{{ t("onboarding.airport.recommendedBase") }}</span>
          <span class="text-caption text-success/90">
            {{ t("onboarding.airport.recommendedDescription") }}
          </span>
        </div>
      </div>
      <div
        v-else
        class="rounded-lg bg-warning/10 p-3 text-body text-warning flex items-start gap-3"
      >
        <span
          class="font-bold"
          aria-hidden="true"
        >!</span>
        <div>
          <span class="font-semibold block">{{ t("onboarding.airport.suboptimalBase") }}</span>
          <span class="text-caption text-warning/90">
            {{ t("onboarding.airport.suboptimalDescription") }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
