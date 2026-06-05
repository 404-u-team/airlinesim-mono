<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard, AirSelect } from "@airlinesim/air-ui";
import { computed, onMounted, onUnmounted, ref } from "vue";

import {
  connectImportJobSocket,
  getImportJob,
  type ImportIssue,
  type ImportJob,
  type ImportJobSocket,
  startImportJob,
} from "../api/importApi";

const props = defineProps<{ appLocale: Locale }>();
const messages = {
  en: {
    admin: "Admin", allEntities: "All entities", allSeverities: "All severities", cachedAction: "Start import", cachedDescription: "Import using the latest locally cached source files.",
    cachedTitle: "Import cached sources",
    cancel: "Cancel", confirm: "Confirm import", confirmCached: "Run a real import using cached sources?",
    confirmDescription: "World records may be created or updated. Run dry-run first and review its report.", confirmRefresh: "Refresh sources and run a real import?", description: "Validate or import countries, regions, airports and aircraft types through BFF. Region links are created lazily from demand requests. Run dry-run first. Source refresh does not delete existing backend data.", dryAction: "Start dry run",
    dryDescription: "Build and validate the dataset without backend mutations.",
    dryRun: "Dry run", dryTitle: "Dry run", entityFilter: "Entity", errors: "Errors", failed: "Failed",
    firstErrors: "First errors", firstWarnings: "First warnings", import: "Import", issues: "First issues", jobId: "Job ID",
    latest: "Latest job", liveConnected: "Realtime connected", liveDisconnected: "Realtime disconnected", logs: "Import log", mode: "Mode",
    progress: "Progress", queued: "Queued", refreshAction: "Refresh and import", refreshDescription: "Download source files again, then reconcile and import them.", refreshTitle: "Refresh sources and import", running: "Running",
    severityFilter: "Severity", stage: "Stage", startError: "Could not start import.", status: "Status", statusError: "Could not read import status.", succeeded: "Succeeded", title: "World data import", warnings: "Warnings",
  },
  ru: {
    admin: "Админка", allEntities: "Все сущности", allSeverities: "Все уровни", cachedAction: "Запустить импорт", cachedDescription: "Импортировать последние локально сохранённые исходные данные.",
    cachedTitle: "Импорт из кеша",
    cancel: "Отмена", confirm: "Подтвердить импорт", confirmCached: "Запустить реальный импорт из кешированных источников?",
    confirmDescription: "Записи мира могут быть созданы или обновлены. Сначала выполните проверочный запуск и изучите отчёт.", confirmRefresh: "Обновить источники и запустить реальный импорт?", description: "Проверьте или импортируйте страны, регионы, аэропорты и типы самолётов через BFF. Связи регионов создаются лениво при запросах спроса. Сначала выполните проверочный запуск. Обновление источников не удаляет существующие данные backend.", dryAction: "Запустить проверку",
    dryDescription: "Собрать и проверить набор данных без изменений в backend.",
    dryRun: "Проверочный запуск", dryTitle: "Проверочный запуск", entityFilter: "Сущность", errors: "Ошибки", failed: "Ошибка",
    firstErrors: "Первые ошибки", firstWarnings: "Первые предупреждения", import: "Импорт", issues: "Первые проблемы", jobId: "ID задачи",
    latest: "Последняя задача", liveConnected: "Realtime подключён", liveDisconnected: "Realtime отключён", logs: "Журнал импорта", mode: "Режим",
    progress: "Прогресс", queued: "В очереди", refreshAction: "Обновить и импортировать", refreshDescription: "Повторно загрузить исходные файлы, сверить и импортировать их.", refreshTitle: "Обновление источников и импорт", running: "Выполняется",
    severityFilter: "Уровень", stage: "Этап", startError: "Не удалось запустить импорт.", status: "Статус", statusError: "Не удалось получить статус импорта.", succeeded: "Завершено", title: "Импорт данных мира", warnings: "Предупреждения",
  },
} as const;
const t = (key: keyof typeof messages.en) => messages[props.appLocale][key];
const activeJob = ref<ImportJob | null>(null);
const error = ref("");
const isStarting = ref(false);
const isRealtimeConnected = ref(false);
const pendingImport = ref<null | { mode: "import"; refreshRaw: boolean }>(null);
const entityFilter = ref("");
const severityFilter = ref("");
let importSocket: ImportJobSocket | null = null;
let pollTimer: null | ReturnType<typeof setTimeout> = null;

const statusTone = computed(() => {
  if (activeJob.value?.status === "succeeded") {return "success" as const;}
  if (activeJob.value?.status === "failed") {return "danger" as const;}
  return "warning" as const;
});
const modeLabel = computed(() => activeJob.value?.mode === "dry-run" ? t("dryRun") : t("import"));
const statusLabel = computed(() => activeJob.value ? t(activeJob.value.status) : "");
const progressCounts = computed(() => activeJob.value?.progress.counts ?? activeJob.value?.report?.counts ?? {});
const progressDetail = computed(() => {
  const progress = activeJob.value?.progress;
  if (!progress?.current || !progress.total) {return progress?.message ?? "";}
  return `${progress.message} · ${String(progress.current)} / ${String(progress.total)}`;
});
const issues = computed<Array<ImportIssue & { severity: "error" | "warning" }>>(() => [
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
const reversedLogs = computed(() => [...(activeJob.value?.logs ?? [])].reverse());

onMounted(() => {
  importSocket = connectImportJobSocket(
    (job) => {
      activeJob.value = job;
      error.value = "";
    },
    (connected) => {
      isRealtimeConnected.value = connected;
      if (!connected && activeJob.value && isActive(activeJob.value)) {
        schedulePoll(activeJob.value.id);
      }
    },
  );
});

onUnmounted(() => {
  importSocket?.close();
  if (pollTimer) {clearTimeout(pollTimer);}
});

async function confirmImport(): Promise<void> {
  const pending = pendingImport.value;
  pendingImport.value = null;
  if (pending) {
    await startImport(pending.mode, pending.refreshRaw);
  }
}

function isActive(job: ImportJob): boolean {
  return job.status === "queued" || job.status === "running";
}

async function pollJob(jobId: string): Promise<void> {
  try {
    activeJob.value = await getImportJob(jobId);
    if (!isRealtimeConnected.value && isActive(activeJob.value)) {
      schedulePoll(jobId);
    }
  } catch {
    error.value = t("statusError");
  }
}

function requestImport(refreshRaw: boolean): void {
  pendingImport.value = { mode: "import", refreshRaw };
}

function schedulePoll(jobId: string): void {
  if (pollTimer) {clearTimeout(pollTimer);}
  pollTimer = setTimeout(() => void pollJob(jobId), 1500);
}

async function startImport(mode: "dry-run" | "import", refreshRaw: boolean): Promise<void> {
  isStarting.value = true;
  error.value = "";
  try {
    const jobId = await startImportJob(mode, refreshRaw);
    importSocket?.subscribe(jobId);
    await pollJob(jobId);
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
    <AirBadge
      class="mt-3"
      :label="isRealtimeConnected ? t('liveConnected') : t('liveDisconnected')"
      :variant="isRealtimeConnected ? 'success-soft' : 'warning-soft'"
    />

    <p v-if="error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
      {{ error }}
    </p>

    <div v-if="pendingImport" class="mt-4 rounded-lg border border-warning bg-warning-bg p-4 text-warning">
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
      <article class="rounded-lg border border-warning bg-warning-bg p-4 text-warning">
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
      <div class="mt-4 rounded-lg border border-border bg-surface-subtle p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong>{{ t("progress") }}: {{ activeJob.progress.percent }}%</strong>
          <span class="text-caption text-text-muted">{{ t("stage") }}: {{ activeJob.progress.stage }}</span>
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-border">
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-300"
            :style="{ width: `${activeJob.progress.percent}%` }"
          />
        </div>
        <p class="mt-2 text-body text-text-muted">
          {{ progressDetail }}
        </p>
      </div>
      <p v-if="activeJob.error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
        {{ activeJob.error }}
      </p>
      <div v-if="Object.keys(progressCounts).length" class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AirMetricCard
          v-for="(value, key) in progressCounts"
          :key="key"
          :label="key"
          :value="String(value)"
        />
      </div>
      <div v-if="reversedLogs.length" class="mt-4 rounded-lg border border-border p-3">
        <h3 class="text-subtitle">
          {{ t("logs") }}
        </h3>
        <div class="mt-3 max-h-96 space-y-2 overflow-y-auto font-mono text-caption">
          <article
            v-for="(item, index) in reversedLogs"
            :key="`${item.timestamp}-${item.operation}-${index}`"
            class="rounded-md border p-3"
            :class="item.level === 'error' ? 'border-error bg-error-bg' : item.level === 'warning' ? 'border-warning bg-warning-bg' : 'border-border bg-surface-subtle'"
          >
            <div class="flex flex-wrap gap-x-2 gap-y-1">
              <strong>{{ item.level.toUpperCase() }}</strong>
              <span>{{ new Date(item.timestamp).toLocaleTimeString(appLocale) }}</span>
              <span>{{ item.stage }} / {{ item.operation }}</span>
              <span v-if="item.entityType">{{ item.entityType }}</span>
              <span v-if="item.sourceKey">{{ item.sourceKey }}</span>
            </div>
            <p class="mt-1 break-words">
              {{ item.message }}
            </p>
            <pre v-if="item.details" class="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-text-muted">{{ JSON.stringify(item.details, null, 2) }}</pre>
          </article>
        </div>
      </div>
      <template v-if="activeJob.report">
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AirMetricCard :label="t('warnings')" tone="warning" :value="String(activeJob.report.warnings)" />
          <AirMetricCard :label="t('errors')" tone="danger" :value="String(activeJob.report.errors)" />
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
