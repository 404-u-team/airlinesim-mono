<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import type { FleetMessageKey } from "../i18n";

import FlightBoard from "./FlightBoard.vue";
import FuelOperationsView from "./FuelOperationsView.vue";
import ScheduleBuilder from "./ScheduleBuilder.vue";

defineProps<{
  appLocale: Locale;
  appTheme?: "dark" | "light";
  mode: "flights" | "fuel" | "schedule";
  shellPath?: string;
  t: (key: FleetMessageKey | string) => string;
}>();
</script>

<template>
  <ScheduleBuilder
    v-if="mode === 'schedule'"
    :app-locale="appLocale"
    :app-theme="appTheme"
    :shell-path="shellPath"
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
