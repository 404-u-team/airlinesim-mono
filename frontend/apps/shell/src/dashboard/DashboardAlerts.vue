<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed } from "vue";
import { useRouter } from "vue-router";

import type { DashboardAlert } from "./types";

import { type ShellMessageKey, shellMessages } from "../i18n/messages";

const props = defineProps<{
  alerts: DashboardAlert[];
  appLocale: Locale;
}>();
const emit = defineEmits<{
  ignore: [alert: DashboardAlert];
}>();

const router = useRouter();
const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

function alertKey(code: string): ShellMessageKey {
  return `dashboard.alert.${code}` as ShellMessageKey;
}

function openAlert(alert: DashboardAlert): void {
  void router.push(alert.target_path);
}

function variantFor(alert: DashboardAlert): "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" {
  if (alert.severity === "danger") {
    return "danger-soft";
  }
  if (alert.severity === "success") {
    return "success-soft";
  }
  if (alert.severity === "warning") {
    return "warning-soft";
  }

  return "primary-soft";
}
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-subtitle">
        {{ t("dashboard.alerts.title") }}
      </h2>
      <AirBadge
        :label="String(alerts.length)"
        variant="warning-soft"
      />
    </div>
    <div class="mt-4 grid gap-3">
      <article
        v-for="alert in alerts"
        :key="alert.code"
        class="rounded-lg border border-border bg-background p-3"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-subtitle">
              {{ t(alertKey(alert.code)) }}
            </p>
            <p class="mt-1 text-caption text-text-muted">
              {{ t(`${alertKey(alert.code)}.description` as ShellMessageKey) }}
            </p>
          </div>
          <AirBadge
            :label="alert.severity"
            :variant="variantFor(alert)"
          />
        </div>
        <AirButton
          class="mt-3"
          :label="t('dashboard.openAction')"
          size="sm"
          variant="primary-soft"
          @click="openAlert(alert)"
        />
        <AirButton
          class="mt-3 ml-2"
          :label="t('dashboard.ignoreAction')"
          size="sm"
          variant="warning-soft"
          @click="emit('ignore', alert)"
        />
      </article>
      <p
        v-if="alerts.length === 0"
        class="text-body text-text-muted"
      >
        {{ t("dashboard.alerts.empty") }}
      </p>
    </div>
  </section>
</template>
