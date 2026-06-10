<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";
import { useRoute } from "vue-router";

import AdminEntityNav from "../components/AdminEntityNav.vue";
import AdminEntityPage from "../components/AdminEntityPage.vue";
import AdminFuturePage from "../components/AdminFuturePage.vue";
import { adminEntityConfigs, defaultAdminEntity } from "../data/entity-configs";
import { futureEntities } from "../data/future-entities";
import AdminAircraftTypesPage from "./AdminAircraftTypesPage.vue";
import AdminAirlinesPage from "./AdminAirlinesPage.vue";
import AdminCalibrationPage from "./AdminCalibrationPage.vue";
import AdminFuelPage from "./AdminFuelPage.vue";
import AdminImportPage from "./AdminImportPage.vue";
import AdminOverviewPage from "./AdminOverviewPage.vue";
import AdminSettingsPage from "./AdminSettingsPage.vue";

type AppTheme = "dark" | "light";

defineProps<{
  appLocale: Locale;
  appTheme: AppTheme;
}>();

const emit = defineEmits<{
  "reset-system-preferences": [];
  "set-locale": [locale: Locale];
  "set-theme": [theme: AppTheme];
}>();

const route = useRoute();

const entitySlug = computed(() => {
  const value = route.params.entity;

  return typeof value === "string" ? value : defaultAdminEntity.id;
});

const activeEntity = computed(
  () => adminEntityConfigs.find((config) => config.id === entitySlug.value) ?? defaultAdminEntity,
);
const isCalibrationRoute = computed(() => route.path === "/admin/calibration");
const isCapabilitiesRoute = computed(() => route.path === "/admin/capabilities");
const isImportRoute = computed(() => route.path === "/admin/import");
const isOverviewRoute = computed(() => route.path === "/admin/overview");
const isAircraftTypesRoute = computed(() => route.path === "/admin/aircraft-types");
const isAirlinesRoute = computed(() => route.path === "/admin/airlines");
const isFuelRoute = computed(() => route.path === "/admin/fuel");
const isSettingsRoute = computed(() => route.path === "/admin/settings");
</script>

<template>
  <main class="grid min-h-0 grid-cols-1 overflow-hidden bg-background text-body text-text-primary lg:grid-cols-[260px_1fr]">
    <AdminEntityNav
      :active-path="route.path"
      :app-locale="appLocale"
      :entities="adminEntityConfigs"
      :future-entities="futureEntities"
    />

    <AdminOverviewPage v-if="isOverviewRoute" :app-locale="appLocale" />
    <AdminImportPage v-else-if="isImportRoute" :app-locale="appLocale" />
    <AdminCalibrationPage v-else-if="isCalibrationRoute" :app-locale="appLocale" />
    <AdminAircraftTypesPage v-else-if="isAircraftTypesRoute" :app-locale="appLocale" />
    <AdminFuelPage v-else-if="isFuelRoute" :app-locale="appLocale" />
    <AdminAirlinesPage v-else-if="isAirlinesRoute" :app-locale="appLocale" />
    <AdminSettingsPage
      v-else-if="isSettingsRoute"
      :app-locale="appLocale"
      :app-theme="appTheme"
      @reset-system-preferences="emit('reset-system-preferences')"
      @set-locale="emit('set-locale', $event)"
      @set-theme="emit('set-theme', $event)"
    />
    <AdminFuturePage
      v-else-if="isCapabilitiesRoute"
      :entities="futureEntities"
      :app-locale="appLocale"
    />
    <AdminEntityPage
      v-else
      :app-locale="appLocale"
      :config="activeEntity"
    />
  </main>
</template>
