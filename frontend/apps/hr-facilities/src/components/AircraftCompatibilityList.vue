<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge } from "@airlinesim/air-ui";

import type { FacilitiesOverview } from "../types";

import { type FacilitiesMessageKey, t } from "../i18n";

const props = defineProps<{
  items: FacilitiesOverview["aircraft_compatibility"];
  locale: Locale;
}>();

function message(key: FacilitiesMessageKey): string {
  return t(props.locale, key);
}
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-subtitle">
      {{ message("compatibility.title") }}
    </h2>
    <p v-if="items.length === 0" class="mt-3 text-body text-text-muted">
      {{ message("compatibility.empty") }}
    </p>
    <div v-else class="mt-4 grid gap-3 lg:grid-cols-2">
      <article v-for="item in items" :key="item.aircraft.id" class="rounded-lg border border-border p-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <strong>{{ item.aircraft.tail_number ?? item.aircraft.id }}</strong>
            <p class="text-caption text-text-muted">
              {{ item.type?.model_name ?? "-" }}
            </p>
          </div>
          <AirBadge :label="message(item.compatible ? 'status.ready' : 'status.blocked')" :variant="item.compatible ? 'success-soft' : 'danger-soft'" />
        </div>
        <p class="mt-2 text-caption text-text-muted">
          {{ message("runway.margin") }}: {{ item.runway_margin_m ?? "-" }} m
        </p>
        <ul v-if="item.constraints.length" class="mt-2 space-y-1 text-caption text-text-muted">
          <li v-for="constraint in item.constraints" :key="constraint.code">
            {{ message(`constraint.${constraint.code}`) }}
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>
