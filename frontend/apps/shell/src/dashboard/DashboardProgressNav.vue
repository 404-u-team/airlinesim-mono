<script setup lang="ts">
import { AirBadge } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed } from "vue";
import { RouterLink } from "vue-router";

import type { DashboardProgressItem } from "./types";

import { type ShellMessageKey, shellMessages } from "../i18n/messages";

const props = defineProps<{
  appLocale: Locale;
  items: DashboardProgressItem[];
}>();

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

function labelKey(path: string): ShellMessageKey {
  if (path.startsWith("/fleet")) {
    return "nav.fleet";
  }
  if (path.startsWith("/airports")) {
    return "nav.airports";
  }
  if (path.startsWith("/operations")) {
    return "nav.operations";
  }
  if (path.startsWith("/finances")) {
    return "nav.finances";
  }
  if (path.startsWith("/staff")) {
    return "nav.staff";
  }

  return "nav.dashboard";
}

function stateVariant(state: DashboardProgressItem["state"]): "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" {
  if (state === "ready") {
    return "success-soft";
  }
  if (state === "blocked") {
    return "warning-soft";
  }
  if (state === "future") {
    return "primary-soft";
  }

  return "warning-soft";
}
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-subtitle">
      {{ t("dashboard.progress.title") }}
    </h2>
    <div class="mt-4 grid gap-2">
      <RouterLink
        v-for="item in items"
        :key="item.path"
        class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 transition hover:border-primary"
        :to="item.next_path"
      >
        <div class="min-w-0">
          <p class="truncate text-body text-text-primary">
            {{ t(labelKey(item.path)) }}
          </p>
          <p class="truncate text-caption text-text-muted">
            {{ t(`dashboard.progress.${item.reason_code}` as ShellMessageKey) }}
          </p>
        </div>
        <AirBadge
          :label="t(`dashboard.progress.state.${item.state}` as ShellMessageKey)"
          :variant="stateVariant(item.state)"
        />
      </RouterLink>
    </div>
  </section>
</template>
