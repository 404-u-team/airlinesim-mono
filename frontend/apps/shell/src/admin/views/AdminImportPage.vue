<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard, AirSelect } from "@airlinesim/air-ui";
import { createApiClient } from "@airlinesim/game-sdk";
import { computed, onUnmounted, ref } from "vue";

import { authState } from "../../auth";

type ImportIssue = {
  entityType: string;
  message: string;
  severity: "error" | "warning";
  sourceKey: string;
};

type ImportJob = {
  error?: string;
  id: string;
  mode: "dry-run" | "import";
  report?: {
    counts: Record<string, number>;
    errors: number;
    firstErrors: Array<{ entityType: string; message: string; sourceKey: string }>;
    firstWarnings: Array<{ entityType: string; message: string; sourceKey: string }>;
    quality: Record<string, number>;
    warnings: number;
  };
  status: "failed" | "queued" | "running" | "succeeded";
};

const props = defineProps<{ appLocale: Locale }>();
const messages = {
  en: {
    admin: "Admin", allEntities: "All entities", allSeverities: "All severities", cachedAction: "Start import", cachedDescription: "Import using the latest locally cached source files.",
    cachedTitle: "Import cached sources",
    cancel: "Cancel", confirm: "Confirm import", confirmCached: "Run a real import using cached sources?",
    confirmDescription: "World records may be created or updated. Run dry-run first and review its report.", confirmRefresh: "Refresh sources and run a real import?", description: "Validate or import countries, regions, airports, region links and aircraft types through BFF. Run dry-run first. Source refresh does not delete existing backend data.", dryAction: "Start dry run",
    dryDescription: "Build and validate the dataset without backend mutations.",
    dryRun: "Dry run", dryTitle: "Dry run", entityFilter: "Entity", errors: "Errors", failed: "Failed",
    firstErrors: "First errors", firstWarnings: "First warnings", import: "Import", issues: "First issues", jobId: "Job ID",
    latest: "Latest job", mode: "Mode",
    queued: "Queued", refreshAction: "Refresh and import", refreshDescription: "Download source files again, then reconcile and import them.", refreshTitle: "Refresh sources and import", running: "Running",
    severityFilter: "Severity", startError: "Could not start import.", status: "Status", statusError: "Could not read import status.", succeeded: "Succeeded", title: "World data import", warnings: "Warnings",
  },
  ru: {
    admin: "Админка", allEntities: "Все сущности", allSeverities: "Все уровни", cachedAction: "Запустить импорт", cachedDescription: "Импортировать последние локально сохранённые исходные данные.",
    cachedTitle: "Импорт из кеша",
    cancel: "Отмена", confirm: "Подтвердить импорт", confirmCached: "Запустить реальный импорт из кешированных источников?",
    confirmDescription: "Записи мира могут быть созданы или обновлены. Сначала выполните проверочный запуск и изучите отчёт.", confirmRefresh: "Обновить источники и запустить реальный импорт?", description: "Проверьте или импортируйте страны, регионы, аэропорты, связи регионов и типы самолётов через BFF. Сначала выполните проверочный запуск. Обновление источников не удаляет существующие данные backend.", dryAction: "Запустить проверку",
    dryDescription: "Собрать и проверить набор данных без изменений в backend.",
    dryRun: "Проверочный запуск", dryTitle: "Проверочный запуск", entityFilter: "Сущность", errors: "Ошибки", failed: "Ошибка",
    firstErrors: "Первые ошибки", firstWarnings: "Первые предупреждения", import: "Импорт", issues: "Первые проблемы", jobId: "ID задачи",
    latest: "Последняя задача", mode: "Режим",
    queued: "В очереди", refreshAction: "Обновить и импортировать", refreshDescription: "Повторно загрузить исходные файлы, сверить и импортировать их.", refreshTitle: "Обновление источников и импорт", running: "Выполняется",
    severityFilter: "Уровень", startError: "Не удалось запустить импорт.", status: "Статус", statusError: "Не удалось получить статус импорта.", succeeded: "Завершено", title: "Импорт данных мира", warnings: "Предупреждения",
  },
} as const;
const t = (key: keyof typeof messages.en) => messages[props.appLocale][key];
const apiClient = createApiClient({ getToken: () => authState.accessToken.value });
const activeJob = ref<ImportJob | null>(null);
const error = ref("");
const isStarting = ref(false);
const pendingImport = ref<null | { mode: "import"; refreshRaw: boolean }>(null);
const entityFilter = ref("");
const severityFilter = ref("");
let pollTimer: null | ReturnType<typeof setTimeout> = null;

const statusTone = computed(() => {
  if (activeJob.value?.status === "succeeded") {return "success" as const;}
  if (activeJob.value?.status === "failed") {return "danger" as const;}
  return "warning" as const;
});
const modeLabel = computed(() => activeJob.value?.mode === "dry-run" ? t("dryRun") : t("import"));
const statusLabel = computed(() => activeJob.value ? t(activeJob.value.status) : "");
const issues = computed<ImportIssue[]>(() => [
  ...(activeJob.value?.report?.firstErrors ?? []).map((issue) => ({ ...issue, severity: "error" as const })),
  ...(activeJob.value?.report?.firstWarnings ?? []).map((issue) => ({ ...issue, severity: "warning" as const })),
]);
const entityOptions = computed(() => [
  { label: t("allEntities"), value: "" },
  ...Array.from(new Set(issues.value.map((issue) => issue.entityType))).sort().map((entityType) => ({
    label: entityType,
    value: entityType,
  })),
]);
const severityOptions = computed(() => [
  { label: t("allSeverities"), value: "" },
  { label: t("errors"), value: "error" },
  { label: t("warnings"), value: "warning" },
]);
const filteredIssues = computed(() => issues.value.filter((issue) =>
  (!entityFilter.value || issue.entityType === entityFilter.value) &&
  (!severityFilter.value || issue.severity === severityFilter.value)));

onUnmounted(() => {
  if (pollTimer) {clearTimeout(pollTimer);}
});

async function confirmImport(): Promise<void> {
  const pending = pendingImport.value;
  pendingImport.value = null;
  if (pending) {
    await startImport(pending.mode, pending.refreshRaw);
  }
}

async function pollJob(jobId: string): Promise<void> {
  try {
    const response = await apiClient.get<{ job: ImportJob }>(`/admin/import/world-data/jobs/${encodeURIComponent(jobId)}`);
    activeJob.value = response.job;
    if (response.job.status === "queued" || response.job.status === "running") {
      pollTimer = setTimeout(() => void pollJob(jobId), 1500);
    }
  } catch {
    error.value = t("statusError");
  }
}

function requestImport(refreshRaw: boolean): void {
  pendingImport.value = { mode: "import", refreshRaw };
}

async function startImport(mode: "dry-run" | "import", refreshRaw: boolean): Promise<void> {
  isStarting.value = true;
  error.value = "";
  try {
    const response = await apiClient.post<{ jobId: string }>("/admin/import/world-data", {
      mode,
      refreshRaw,
      source: "admin-ui",
    });
    await pollJob(response.jobId);
  } catch {
    error.value = t("startError");
  } finally {
    isStarting.value = false;
  }
}
</script>

<template>
  <section class="h-full overflow-y-auto p-4 sm:p-6">
    <AirBadge :label="t('admin')" variant="warning-soft" />
    <h1 class="mt-4 text-h2">
      {{ t("title") }}
    </h1>
    <p class="mt-2 max-w-3xl text-text-muted">
      {{ t("description") }}
    </p>

    <p v-if="error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
      {{ error }}
    </p>

    <div v-if="pendingImport" class="mt-4 rounded-lg border border-warning bg-warning-bg p-4 text-slate-950">
      <strong>{{ pendingImport.refreshRaw ? t("confirmRefresh") : t("confirmCached") }}</strong>
      <p class="mt-1 text-body">
        {{ t("confirmDescription") }}
      </p>
      <div class="mt-3 flex gap-2">
        <AirButton
          :label="t('confirm')"
          size="sm"
          variant="warning"
          @click="confirmImport"
        />
        <AirButton
          :label="t('cancel')"
          size="sm"
          variant="primary-soft"
          @click="pendingImport = null"
        />
      </div>
    </div>

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
          @click="requestImport(false)"
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
          @click="requestImport(true)"
        />
      </article>
    </div>

    <section v-if="activeJob" class="mt-6 rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ t("latest") }}
      </h2>
      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <AirMetricCard :label="t('jobId')" :value="activeJob.id" />
        <AirMetricCard :label="t('mode')" :value="modeLabel" />
        <AirMetricCard :label="t('status')" :tone="statusTone" :value="statusLabel" />
      </div>
      <p v-if="activeJob.error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
        {{ activeJob.error }}
      </p>
      <template v-if="activeJob.report">
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AirMetricCard :label="t('warnings')" tone="warning" :value="String(activeJob.report.warnings)" />
          <AirMetricCard :label="t('errors')" tone="danger" :value="String(activeJob.report.errors)" />
          <AirMetricCard
            v-for="(value, key) in activeJob.report.counts"
            :key="key"
            :label="key"
            :value="String(value)"
          />
        </div>
        <div v-if="issues.length" class="mt-4 rounded-lg border border-border p-3">
          <h3 class="text-subtitle">
            {{ t("issues") }}
          </h3>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <AirSelect
              :label="t('severityFilter')"
              :model-value="severityFilter"
              :options="severityOptions"
              @update:model-value="severityFilter = $event"
            />
            <AirSelect
              :label="t('entityFilter')"
              :model-value="entityFilter"
              :options="entityOptions"
              @update:model-value="entityFilter = $event"
            />
          </div>
          <div class="mt-3 grid gap-2">
            <p
              v-for="item in filteredIssues"
              :key="`${item.severity}-${item.entityType}-${item.sourceKey}-${item.message}`"
              class="rounded-md border p-3 text-caption"
              :class="item.severity === 'error' ? 'border-error bg-error-bg' : 'border-warning bg-warning-bg'"
            >
              <strong>{{ item.severity === "error" ? t("errors") : t("warnings") }}</strong>
              · {{ item.entityType }} · {{ item.sourceKey }} · {{ item.message }}
            </p>
          </div>
        </div>
      </template>
    </section>
  </section>
</template>
