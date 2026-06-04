<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";
import { useRoute } from "vue-router";

import AdminEntityNav from "../components/AdminEntityNav.vue";
import AdminEntityPage from "../components/AdminEntityPage.vue";
import AdminFuturePage from "../components/AdminFuturePage.vue";
import { adminEntityConfigs, defaultAdminEntity } from "../data/entity-configs";
import { futureEntities } from "../data/future-entities";
import AdminImportPage from "./AdminImportPage.vue";
import AdminOverviewPage from "./AdminOverviewPage.vue";

defineProps<{ appLocale: Locale }>();

const route = useRoute();

const entitySlug = computed(() => {
  const value = route.params.entity;

  return typeof value === "string" ? value : defaultAdminEntity.id;
});

const activeEntity = computed(
  () => adminEntityConfigs.find((config) => config.id === entitySlug.value) ?? defaultAdminEntity,
);
const isCapabilitiesRoute = computed(() => route.path === "/admin/capabilities");
const isImportRoute = computed(() => route.path === "/admin/import");
const isOverviewRoute = computed(() => route.path === "/admin/overview");
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
