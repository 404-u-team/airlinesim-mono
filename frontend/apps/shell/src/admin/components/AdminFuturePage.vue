<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { computed } from "vue";

import type { FutureEntity } from "../types";

import { adminText } from "../i18n";

const props = defineProps<{
  appLocale: Locale;
  entities: FutureEntity[];
  entity?: FutureEntity;
}>();

const visibleEntities = computed(() => (props.entity ? [props.entity] : props.entities));
</script>

<template>
  <section class="min-h-0 overflow-y-auto p-4 sm:p-6">
    <div class="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <AirBadge
          :label="adminText(appLocale, 'disabled')"
          variant="warning-soft"
        />
        <h1 class="mt-4 text-h2 text-text-primary">
          {{ adminText(appLocale, "toBeEnabled") }}
        </h1>
        <p class="mt-2 max-w-3xl text-body text-text-muted">
          {{ adminText(appLocale, "capabilitiesDescription") }}
        </p>
      </div>
      <AirButton
        :label="adminText(appLocale, 'create')"
        size="sm"
        disabled
        variant="warning"
      />
    </div>

    <div class="mt-6 grid gap-4 xl:grid-cols-2">
      <article
        v-for="futureEntity in visibleEntities"
        :key="futureEntity.route"
        class="rounded-lg border border-border bg-surface p-4"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-h4 text-text-primary">
              {{ futureEntity.title }}
            </h2>
            <p class="mt-2 text-body text-text-muted">
              {{ appLocale === "ru" ? adminText(appLocale, "capabilitiesDescription") : futureEntity.description }}
            </p>
          </div>
          <AirBadge
            :label="adminText(appLocale, 'locked')"
            size="sm"
            variant="warning-soft"
          />
        </div>

        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-caption text-text-muted">
              {{ adminText(appLocale, "missing") }}
            </p>
            <ul class="mt-2 space-y-1 text-body text-text-primary">
              <li
                v-for="item in futureEntity.missing"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </div>
          <div>
            <p class="text-caption text-text-muted">
              {{ adminText(appLocale, "unlock") }}
            </p>
            <ul class="mt-2 space-y-1 text-body text-text-primary">
              <li
                v-for="item in futureEntity.unlockCriteria"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </div>
        </div>

        <div class="mt-4 flex gap-2">
          <AirButton
            :label="adminText(appLocale, 'create')"
            size="sm"
            disabled
          />
          <AirButton
            :label="adminText(appLocale, 'edit')"
            size="sm"
            disabled
            variant="primary-soft"
          />
        </div>
      </article>
    </div>
  </section>
</template>
