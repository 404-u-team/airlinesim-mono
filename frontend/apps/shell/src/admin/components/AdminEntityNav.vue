<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge } from "@airlinesim/air-ui";
import { RouterLink } from "vue-router";

import type { AdminEntityConfig, FutureEntity } from "../types";

import { adminText, localizeAdminLabel } from "../i18n";

defineProps<{
  activePath: string;
  appLocale: Locale;
  entities: AdminEntityConfig[];
  futureEntities: FutureEntity[];
}>();
</script>

<template>
  <aside class="max-h-52 overflow-y-auto border-b border-border bg-surface p-3 lg:max-h-none lg:min-h-0 lg:border-b-0 lg:border-r">
    <div class="px-2 pb-3">
      <AirBadge
        :label="adminText(appLocale, 'admin')"
        size="sm"
        variant="primary-soft"
      />
      <h2 class="mt-3 text-h4 text-text-primary">
        {{ adminText(appLocale, "admin") }}
      </h2>
    </div>

    <nav class="space-y-5">
      <div>
        <p class="px-2 text-caption text-text-muted">
          {{ adminText(appLocale, "enabled") }}
        </p>
        <div class="mt-2 space-y-1">
          <RouterLink
            to="/admin/overview"
            class="block rounded-md px-2 py-2 text-body transition hover:bg-surface-subtle"
            :class="activePath === '/admin/overview' ? 'text-primary font-medium' : 'text-text-muted'"
          >
            {{ adminText(appLocale, "readiness") }}
          </RouterLink>
          <RouterLink
            to="/admin/import"
            class="block rounded-md px-2 py-2 text-body transition hover:bg-surface-subtle"
            :class="activePath === '/admin/import' ? 'text-primary font-medium' : 'text-text-muted'"
          >
            {{ adminText(appLocale, "worldImport") }}
          </RouterLink>
          <RouterLink
            v-for="entity in entities"
            :key="entity.id"
            :to="`/admin/${entity.id}`"
            class="block rounded-md px-2 py-2 text-body transition hover:bg-surface-subtle"
            :class="activePath === `/admin/${entity.id}` ? 'text-primary font-medium' : 'text-text-muted'"
          >
            {{ localizeAdminLabel(appLocale, entity.title) }}
          </RouterLink>
        </div>
      </div>

      <div>
        <p class="px-2 text-caption text-text-muted">
          {{ adminText(appLocale, "toBeEnabled") }}
        </p>
        <RouterLink
          to="/admin/capabilities"
          class="mt-2 block rounded-md px-2 py-2 text-body text-text-muted transition hover:bg-surface-subtle"
          :class="activePath === '/admin/capabilities' ? 'text-primary font-medium' : ''"
        >
          {{ adminText(appLocale, "capabilities") }} ({{ futureEntities.length }})
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>
