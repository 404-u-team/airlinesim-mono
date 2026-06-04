<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { createApiClient } from "@airlinesim/game-sdk";
import { computed, onUnmounted, ref } from "vue";

import { authState } from "../../auth";

type ImportJob = {
  error?: string;
  id: string;
  mode: "dry-run" | "import";
  status: "completed" | "failed" | "pending" | "running";
  summary?: Record<string, unknown>;
};

const props = defineProps<{ appLocale: Locale }>();
const messages = {
  en: {
    cachedAction: "Start import", cachedDescription: "Import using the latest locally cached source files.", cachedTitle: "Import cached sources",
    description: "Validate or import countries, regions, airports, region links and aircraft types through BFF. Run dry-run first. Source refresh does not delete existing backend data.",
    dryAction: "Start dry run", dryDescription: "Build and validate the dataset without backend mutations.", dryTitle: "Dry run",
    jobId: "Job ID", latest: "Latest job", mode: "Mode", refreshAction: "Refresh and import",
    refreshDescription: "Download source files again, then reconcile and import them.", refreshTitle: "Refresh sources and import",
    startError: "Could not start import.", status: "Status", statusError: "Could not read import status.", title: "World data import",
  },
  ru: {
    cachedAction: "Запустить импорт", cachedDescription: "Импортировать последние локально сохранённые исходные данные.", cachedTitle: "Импорт из кеша",
    description: "Проверьте или импортируйте страны, регионы, аэропорты, связи регионов и типы самолётов через BFF. Сначала выполните проверочный запуск. Обновление источников не удаляет существующие данные backend.",
    dryAction: "Запустить проверку", dryDescription: "Собрать и проверить набор данных без изменений в backend.", dryTitle: "Проверочный запуск",
    jobId: "ID задачи", latest: "Последняя задача", mode: "Режим", refreshAction: "Обновить и импортировать",
    refreshDescription: "Повторно загрузить исходные файлы, сверить и импортировать их.", refreshTitle: "Обновление источников и импорт",
    startError: "Не удалось запустить импорт.", status: "Статус", statusError: "Не удалось получить статус импорта.", title: "Импорт данных мира",
  },
} as const;
const t = (key: keyof typeof messages.en) => messages[props.appLocale][key];
const apiClient = createApiClient({ getToken: () => authState.accessToken.value });
const activeJob = ref<ImportJob | null>(null);
const error = ref("");
const isStarting = ref(false);
let pollTimer: null | ReturnType<typeof setTimeout> = null;

const statusTone = computed(() => {
  if (activeJob.value?.status === "completed") {return "success" as const;}
  if (activeJob.value?.status === "failed") {return "danger" as const;}
  return "warning" as const;
});

onUnmounted(() => {
  if (pollTimer) {clearTimeout(pollTimer);}
});

async function pollJob(jobId: string): Promise<void> {
  try {
    const response = await apiClient.get<{ job: ImportJob }>(`/import/world-data/jobs/${encodeURIComponent(jobId)}`);
    activeJob.value = response.job;
    if (response.job.status === "pending" || response.job.status === "running") {
      pollTimer = setTimeout(() => void pollJob(jobId), 1500);
    }
  } catch (pollError) {
    error.value = pollError instanceof Error ? pollError.message : t("statusError");
  }
}

async function startImport(mode: "dry-run" | "import", refreshRaw: boolean): Promise<void> {
  isStarting.value = true;
  error.value = "";
  try {
    const response = await apiClient.post<{ jobId: string }>("/import/world-data", {
      mode,
      refreshRaw,
      source: "admin-ui",
    });
    await pollJob(response.jobId);
  } catch (startError) {
    error.value = startError instanceof Error ? startError.message : t("startError");
  } finally {
    isStarting.value = false;
  }
}
</script>

<template>
  <section class="h-full overflow-y-auto p-4 sm:p-6">
    <AirBadge label="Admin" variant="warning-soft" />
    <h1 class="mt-4 text-h2">
      {{ t("title") }}
    </h1>
    <p class="mt-2 max-w-3xl text-text-muted">
      {{ t("description") }}
    </p>

    <p v-if="error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
      {{ error }}
    </p>

    <div class="mt-6 grid gap-4 md:grid-cols-3">
      <article class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          {{ t("dryTitle") }}
        </h2>
        <p class="mt-2 text-text-muted">
          {{ t("dryDescription") }}
        </p>
        <AirButton
          class="mt-4 w-full"
          :disabled="isStarting"
          :label="t('dryAction')"
          @click="startImport('dry-run', false)"
        />
      </article>
      <article class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          {{ t("cachedTitle") }}
        </h2>
        <p class="mt-2 text-text-muted">
          {{ t("cachedDescription") }}
        </p>
        <AirButton
          class="mt-4 w-full"
          :disabled="isStarting"
          :label="t('cachedAction')"
          variant="success"
          @click="startImport('import', false)"
        />
      </article>
      <article class="rounded-lg border border-warning bg-warning-bg p-4 text-slate-950">
        <h2 class="text-subtitle">
          {{ t("refreshTitle") }}
        </h2>
        <p class="mt-2">
          {{ t("refreshDescription") }}
        </p>
        <AirButton
          class="mt-4 w-full"
          :disabled="isStarting"
          :label="t('refreshAction')"
          variant="warning"
          @click="startImport('import', true)"
        />
      </article>
    </div>

    <section v-if="activeJob" class="mt-6 rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ t("latest") }}
      </h2>
      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <AirMetricCard :label="t('jobId')" :value="activeJob.id" />
        <AirMetricCard :label="t('mode')" :value="activeJob.mode" />
        <AirMetricCard :label="t('status')" :tone="statusTone" :value="activeJob.status" />
      </div>
      <p v-if="activeJob.error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
        {{ activeJob.error }}
      </p>
      <pre v-if="activeJob.summary" class="mt-4 max-h-96 overflow-auto rounded-lg bg-background p-3 text-caption">{{ JSON.stringify(activeJob.summary, null, 2) }}</pre>
    </section>
  </section>
</template>
