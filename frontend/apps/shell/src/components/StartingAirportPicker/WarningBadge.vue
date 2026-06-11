<script setup lang="ts">
import { type Locale, translate } from "@airlinesim/i18n";
import { computed } from "vue";

import { type ShellMessageKey, shellMessages } from "../../i18n/messages";

const props = defineProps<{
  appLocale: Locale;
  warning: string;
}>();

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

const warningKey = computed<ShellMessageKey>(() => {
  switch (props.warning) {
    case "HIGH_FEES":
      return "onboarding.airport.highFees";
    case "LOW_SLOT_CAPACITY":
      return "onboarding.airport.lowSlotCapacity";
    case "MISSING_REGION_DATA":
      return "onboarding.airport.missingRegionData";
    case "NO_NIGHT_OPS":
      return "onboarding.airport.noNightOps";
    case "SHORT_RUNWAY":
      return "onboarding.airport.shortRunway";
    default:
      return "auth.error.default";
  }
});
</script>

<template>
  <span class="inline-flex items-center rounded-md bg-error/10 px-2 py-0.5 text-caption font-medium text-error ring-1 ring-inset ring-error/20">
    {{ t(warningKey) }}
  </span>
</template>
