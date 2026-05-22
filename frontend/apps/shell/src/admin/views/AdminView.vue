<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

import AdminEntityNav from "../components/AdminEntityNav.vue";
import AdminEntityPage from "../components/AdminEntityPage.vue";
import AdminFuturePage from "../components/AdminFuturePage.vue";
import { adminEntityConfigs, defaultAdminEntity } from "../data/entity-configs";
import { futureEntities } from "../data/future-entities";

const route = useRoute();

const entitySlug = computed(() => {
  const value = route.params.entity;

  return typeof value === "string" ? value : defaultAdminEntity.id;
});

const futureSlug = computed(() => {
  const value = route.params.futureEntity;

  return typeof value === "string" ? value : undefined;
});

const activeEntity = computed(
  () => adminEntityConfigs.find((config) => config.id === entitySlug.value) ?? defaultAdminEntity,
);
const activeFutureEntity = computed(() =>
  futureEntities.find((entity) => entity.route.endsWith(`/${futureSlug.value ?? ""}`)),
);
const isFutureRoute = computed(() => route.path.startsWith("/admin/future"));
</script>

<template>
  <main class="grid min-h-0 grid-cols-1 overflow-hidden bg-background text-body text-text-primary lg:grid-cols-[260px_1fr]">
    <AdminEntityNav
      :active-path="route.path"
      :entities="adminEntityConfigs"
      :future-entities="futureEntities"
    />

    <AdminFuturePage
      v-if="isFutureRoute"
      :entities="futureEntities"
      :entity="activeFutureEntity"
    />
    <AdminEntityPage
      v-else
      :config="activeEntity"
    />
  </main>
</template>
