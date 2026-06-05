<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import type { FleetMessageKey } from "../i18n";

import FlightBoard from "./FlightBoard.vue";
import FuelOperationsView from "./FuelOperationsView.vue";
import ScheduleBuilder from "./ScheduleBuilder.vue";

defineProps<{
  appLocale: Locale;
  mode: "flights" | "fuel" | "schedule";
  t: (key: FleetMessageKey | string) => string;
}>();
</script>

<template>
  <ScheduleBuilder
    v-if="mode === 'schedule'"
    :app-locale="appLocale"
    :t="t"
  />
  <FuelOperationsView
    v-else-if="mode === 'fuel'"
    :app-locale="appLocale"
    :t="t"
  />
  <FlightBoard
    v-else
    :app-locale="appLocale"
    :t="t"
  />
</template>
