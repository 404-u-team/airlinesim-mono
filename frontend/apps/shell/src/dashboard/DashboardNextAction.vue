<script setup lang="ts">
import { AirButton } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { ArrowRight, RefreshCw, X } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import type { DashboardSummary } from "./types";

import { type ShellMessageKey, shellMessages } from "../i18n/messages";

const props = defineProps<{
  appLocale: Locale;
  isRefreshing: boolean;
  summary: DashboardSummary;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const router = useRouter();
const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);
const actionKey = computed(() => props.summary.next_action.code.toLowerCase() as Lowercase<typeof props.summary.next_action.code>);

const isHidden = ref(false);

onMounted(() => {
  if (window.localStorage.getItem("hide_dashboard_next_action") === "true") {
    isHidden.value = true;
  }
});

function goToNextAction(): void {
  void router.push(props.summary.next_action.target_path);
}

function goToSecondaryAction(): void {
  const path = props.summary.next_action.secondary_target_path;

  if (path) {
    void router.push(path);
  }
}

function hidePanel(): void {
  isHidden.value = true;
  window.localStorage.setItem("hide_dashboard_next_action", "true");
}
</script>

<template>
  <section v-show="!isHidden" class="rounded-lg border border-border bg-surface p-5 pr-10">
    <button
      class="absolute right-3 top-3 text-text-muted transition-colors hover:text-text-neutral"
      type="button"
      @click="hidePanel"
    >
      <X :size="20" />
    </button>
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <p class="text-caption text-text-muted">
          {{ t("dashboard.next.eyebrow") }}
        </p>
        <h2 class="mt-1 text-h3">
          {{ t(`dashboard.next.${actionKey}.title` as ShellMessageKey) }}
        </h2>
        <p class="mt-2 max-w-3xl text-body text-text-muted">
          {{ t(`dashboard.next.${actionKey}.description` as ShellMessageKey) }}
        </p>
      </div>
      <div class="flex shrink-0 flex-col gap-2 sm:flex-row">
        <AirButton
          :label="t(`dashboard.next.${actionKey}.cta` as ShellMessageKey)"
          @click="goToNextAction"
        >
          <span class="inline-flex items-center gap-2">
            {{ t(`dashboard.next.${actionKey}.cta` as ShellMessageKey) }}
            <ArrowRight :size="16" />
          </span>
        </AirButton>
        <AirButton
          v-if="summary.next_action.secondary_target_path"
          :label="t('dashboard.next.secondary')"
          variant="primary-soft"
          @click="goToSecondaryAction"
        />
        <AirButton
          :disabled="isRefreshing"
          :label="t('dashboard.refresh')"
          variant="primary-soft"
          @click="emit('refresh')"
        >
          <span class="inline-flex items-center gap-2">
            <RefreshCw
              :class="isRefreshing ? 'animate-spin' : ''"
              :size="16"
            />
            {{ t("dashboard.refresh") }}
          </span>
        </AirButton>
      </div>
    </div>
  </section>
</template>
