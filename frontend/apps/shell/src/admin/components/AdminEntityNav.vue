<script setup lang="ts">
import { AirBadge } from "@airlinesim/air-ui";
import { RouterLink } from "vue-router";

import type { AdminEntityConfig, FutureEntity } from "../types";

defineProps<{
  activePath: string;
  entities: AdminEntityConfig[];
  futureEntities: FutureEntity[];
}>();
</script>

<template>
  <aside class="min-h-0 overflow-y-auto border-r border-border bg-surface p-3">
    <div class="px-2 pb-3">
      <AirBadge
        label="Shell Admin"
        size="sm"
        variant="primary-soft"
      />
      <h2 class="mt-3 text-h4 text-text-primary">
        Admin
      </h2>
    </div>

    <nav class="space-y-5">
      <div>
        <p class="px-2 text-caption text-text-muted">
          Enabled
        </p>
        <div class="mt-2 space-y-1">
          <RouterLink
            to="/admin/import"
            class="block rounded-md px-2 py-2 text-body transition hover:bg-surface-subtle"
            :class="activePath === '/admin/import' ? 'text-primary font-medium' : 'text-text-muted'"
          >
            World data import
          </RouterLink>
          <RouterLink
            v-for="entity in entities"
            :key="entity.id"
            :to="`/admin/${entity.id}`"
            class="block rounded-md px-2 py-2 text-body transition hover:bg-surface-subtle"
            :class="activePath === `/admin/${entity.id}` ? 'text-primary font-medium' : 'text-text-muted'"
          >
            {{ entity.title }}
          </RouterLink>
        </div>
      </div>

      <div>
        <p class="px-2 text-caption text-text-muted">
          To be enabled
        </p>
        <div class="mt-2 space-y-1">
          <span
            v-for="entity in futureEntities"
            :key="entity.route"
            aria-disabled="true"
            class="block cursor-not-allowed rounded-md px-2 py-2 text-body text-text-muted opacity-50"
          >
            {{ entity.title }}
          </span>
        </div>
      </div>
    </nav>
  </aside>
</template>
