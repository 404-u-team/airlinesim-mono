<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { CalibrationArtifact, CalibrationJobStatus, ScorecardRow, SegmentRow } from "../types";

import { getCalibration, getCalibrationJob, getCountries, getLatestCalibrationJob, runCalibration } from "../api/demandApi";
import AdminCalibrationParamsTable from "../components/AdminCalibrationParamsTable.vue";
import AdminCalibrationQuality from "../components/AdminCalibrationQuality.vue";
import AdminCalibrationScatter from "../components/AdminCalibrationScatter.vue";
import AdminCalibrationScorecardTable from "../components/AdminCalibrationScorecardTable.vue";
import AdminCalibrationSegmentsTable from "../components/AdminCalibrationSegmentsTable.vue";
import AdminDemandPairLookup from "../components/AdminDemandPairLookup.vue";
import { adminCalibrationMessages, adminText } from "../i18n";

const props = defineProps<{ appLocale: Locale }>();
const t = (key: keyof typeof adminCalibrationMessages.en) => adminCalibrationMessages[props.appLocale][key];

const calibration = ref<CalibrationArtifact | null>(null);
const scorecard = ref<ScorecardRow[]>([]);
const segments = ref<SegmentRow[]>([]);
const anchorsTotal = ref(0);
const anchorsUsed = ref(0);
const countriesMap = ref<Record<string, { iso: string; name: string }>>({});
const isLoading = ref(false);
const isCalibrating = ref(false);
const error = ref<null | string>(null);
const successMessage = ref<null | string>(null);
const showConfirmModal = ref(false);
const confirmRefresh = ref(false);
const activeJob = ref<CalibrationJobStatus | null>(null);
let pollTimer: null | ReturnType<typeof setTimeout> = null;

const countryInfo = (id: string) => countriesMap.value[id.toLowerCase()] ?? { iso: id.slice(0, 4).toUpperCase(), name: "" };
const progressDetail = computed(() => activeJob.value?.progress?.message ?? "");
const reversedLogs = computed(() => [...(activeJob.value?.logs ?? [])].reverse());

const changedPropensities = computed(() => !calibration.value?.propensityByCountry ? [] : Object.entries(calibration.value.propensityByCountry)
  .map(([country, propensity]) => ({ country, propensity }))
  .filter((item) => Math.abs(item.propensity - 1.0) > 0.001)
  .sort((a, b) => b.propensity - a.propensity));

onMounted(async () => {
  await loadData();
  try {
    const latest = await getLatestCalibrationJob();
    if (latest && latest.job && (latest.job.status === "queued" || latest.job.status === "running")) {
      activeJob.value = latest.job; isCalibrating.value = true; await pollJob(latest.job.id);
    }
  } catch (err) {
    // Ignore error if there is no active/latest job on load
  }
});
onUnmounted(() => { if (pollTimer) {clearTimeout(pollTimer);} });

async function loadData() {
  isLoading.value = true; error.value = null; successMessage.value = null;
  try {
    const [data, countriesData] = await Promise.all([getCalibration(), getCountries()]);
    calibration.value = data;
    const map: Record<string, { iso: string; name: string }> = {};
    if (countriesData?.countries) {
      for (const c of countriesData.countries) {
        map[c.id.toLowerCase()] = { iso: c.iso, name: props.appLocale === "ru" ? (c.local_name || c.intl_name) : c.intl_name };
      }
    }
    countriesMap.value = map;
  } catch (err) {
    console.error("Failed to load calibration data:", err); error.value = t("error");
  } finally { isLoading.value = false; }
}

async function pollJob(jobId: string) {
  try {
    const res = await getCalibrationJob(jobId);
    activeJob.value = res.job;
    if (res.job.status === "queued" || res.job.status === "running") {
      schedulePoll(jobId);
    } else if (res.job.status === "succeeded") {
      successMessage.value = t("success");
      if (res.job.result) {
        calibration.value = res.job.result.artifact; scorecard.value = res.job.result.scorecard;
        segments.value = res.job.result.segments ?? [];
        anchorsTotal.value = res.job.result.anchorsTotal; anchorsUsed.value = res.job.result.anchorsUsed;
      } else { await loadData(); }
      isCalibrating.value = false;
    } else if (res.job.status === "failed") {
      error.value = res.job.error || t("error"); isCalibrating.value = false;
    }
  } catch (err) {
    console.error("Failed to poll calibration job:", err); error.value = t("error"); isCalibrating.value = false;
  }
}

function schedulePoll(jobId: string) {
  if (pollTimer) {clearTimeout(pollTimer);}
  pollTimer = setTimeout(() => void pollJob(jobId), 1000);
}

async function startCalibrate() {
  showConfirmModal.value = false; isCalibrating.value = true; error.value = null; successMessage.value = null; activeJob.value = null;
  try {
    const res = await runCalibration(confirmRefresh.value);
    await pollJob(res.jobId);
  } catch (err) {
    console.error("Failed to run calibration:", err); error.value = t("error"); isCalibrating.value = false;
  }
}

function triggerCalibrate(refresh: boolean) {
  confirmRefresh.value = refresh; showConfirmModal.value = true;
}
</script>

<template>
  <section class="h-full overflow-y-auto p-4 sm:p-6 bg-background text-text-primary">
    <!-- Header -->
    <div class="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <AirBadge :label="t('title')" variant="primary-soft" />
        <h1 class="mt-4 text-h2 font-bold text-text-primary">
          {{ t("title") }}
        </h1>
        <p class="mt-2 max-w-3xl text-body text-text-muted">
          {{ t("description") }}
        </p>
      </div>
      <AirButton
        :label="props.appLocale === 'ru' ? 'Обновить данные' : 'Refresh Data'"
        size="sm"
        variant="primary-soft"
        :disabled="isLoading || isCalibrating"
        @click="loadData"
      />
    </div>

    <!-- Alert Messages -->
    <div v-if="error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
      {{ error }}
    </div>
    <div v-if="successMessage" class="mt-4 rounded-lg border border-success bg-success-bg p-3 text-success">
      {{ successMessage }}
    </div>

    <!-- Calibration Job Logs Console -->
    <div v-if="activeJob" class="mt-4 rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle font-bold">
        {{ appLocale === 'ru' ? 'Ход калибровки' : 'Calibration Progress' }}
      </h2>
      <div class="mt-4 rounded-lg border border-border bg-surface-subtle p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <strong>{{ appLocale === 'ru' ? 'Выполнено' : 'Progress' }}: {{ activeJob.progress.percent }}%</strong>
          <span class="text-caption text-text-muted">{{ appLocale === 'ru' ? 'Этап' : 'Stage' }}: {{ activeJob.progress.stage }}</span>
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

      <div v-if="reversedLogs.length" class="mt-4 rounded-lg border border-border p-3">
        <h3 class="text-caption font-semibold uppercase text-text-muted">
          {{ appLocale === 'ru' ? 'Логи выполнения' : 'Execution Logs' }}
        </h3>
        <div class="mt-3 max-h-48 space-y-2 overflow-y-auto font-mono text-caption">
          <article
            v-for="(item, index) in reversedLogs"
            :key="`${item.timestamp}-${item.operation}-${index}`"
            class="rounded-md border p-3"
            :class="item.level === 'error' ? 'border-error bg-error-bg text-error' : item.level === 'warning' ? 'border-warning bg-warning-bg text-warning' : 'border-border bg-surface-subtle'"
          >
            <div class="flex flex-wrap gap-x-2 gap-y-1">
              <strong>{{ item.level.toUpperCase() }}</strong>
              <span>{{ new Date(item.timestamp).toLocaleTimeString(appLocale) }}</span>
              <span>{{ item.stage }} / {{ item.operation }}</span>
            </div>
            <p class="mt-1 break-words whitespace-pre-wrap">
              {{ item.message }}
            </p>
          </article>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div v-if="showConfirmModal" class="mt-4 rounded-lg border border-warning bg-warning-bg p-4 text-warning">
      <strong class="text-subtitle font-semibold block">{{ t("runConfirm") }}</strong>
      <p class="mt-1 text-body">
        {{ t("runConfirmDesc") }}
      </p>
      <div class="mt-3 flex gap-2">
        <AirButton
          :label="t('confirm')"
          size="sm"
          variant="warning"
          @click="startCalibrate"
        />
        <AirButton
          :label="t('cancel')"
          size="sm"
          variant="primary-soft"
          @click="showConfirmModal = false"
        />
      </div>
    </div>

    <!-- Dashboard Content -->
    <div v-if="calibration" class="mt-6 space-y-6">
      <!-- Quality Scorecard -->
      <AdminCalibrationQuality :anchors-used="anchorsUsed" :app-locale="appLocale" :artifact="calibration" />

      <!-- Actions Grid -->
      <section class="grid gap-4 md:grid-cols-2">
        <article class="rounded-lg border border-border bg-surface p-4 flex flex-col justify-between">
          <div>
            <h3 class="text-subtitle font-bold">
              {{ t("runQuick") }}
            </h3>
            <p class="mt-2 text-text-muted text-body">
              {{ t("runQuickDesc") }}
            </p>
          </div>
          <AirButton
            class="mt-4 w-full"
            :disabled="isCalibrating || isLoading"
            :label="isCalibrating ? '...' : t('runQuick')"
            variant="success"
            @click="triggerCalibrate(false)"
          />
        </article>

        <article class="rounded-lg border border-warning bg-warning-bg/10 p-4 text-warning flex flex-col justify-between">
          <div>
            <h3 class="text-subtitle font-bold">
              {{ t("runFull") }}
            </h3>
            <p class="mt-2 text-body">
              {{ t("runFullDesc") }}
            </p>
          </div>
          <AirButton
            class="mt-4 w-full"
            :disabled="isCalibrating || isLoading"
            :label="isCalibrating ? '...' : t('runFull')"
            variant="warning"
            @click="triggerCalibrate(true)"
          />
        </article>
      </section>

      <!-- Parameters & Propensities Column Layout -->
      <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
        <!-- Parameters Table -->
        <section class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-h4 font-bold mb-4">
            {{ t("parameters") }}
          </h2>
          <AdminCalibrationParamsTable :app-locale="appLocale" :params="calibration.params" />
        </section>

        <!-- Propensities Column -->
        <section class="rounded-lg border border-border bg-surface p-4 flex flex-col">
          <h2 class="text-h4 font-bold mb-2">
            {{ t("propensities") }}
          </h2>
          <p class="text-caption text-text-muted mb-4">
            {{ props.appLocale === 'ru' ? 'Страны с отклонением от нейтрального 1.0 авиа-спроса.' : 'Countries deviating from the neutral 1.0 aviation propensity.' }}
          </p>
          <div class="flex-1 overflow-y-auto max-h-[350px] border border-border rounded-md divide-y divide-border">
            <div
              v-for="item in changedPropensities"
              :key="item.country"
              class="flex items-center justify-between p-3 text-body"
            >
              <div class="flex items-center gap-2 min-w-0">
                <AirBadge :label="countryInfo(item.country).iso" variant="primary-soft" />
                <span class="text-body font-medium truncate" :title="countryInfo(item.country).name">
                  {{ countryInfo(item.country).name }}
                </span>
              </div>
              <span class="font-mono font-semibold shrink-0" :class="item.propensity > 1 ? 'text-success' : 'text-warning'">
                ×{{ item.propensity.toFixed(3) }}
              </span>
            </div>
            <div v-if="changedPropensities.length === 0" class="p-4 text-center text-text-muted text-body">
              {{ props.appLocale === 'ru' ? 'Все страны имеют нейтральный коэффициент 1.0' : 'All countries have a neutral 1.0 propensity' }}
            </div>
          </div>
        </section>
      </div>

      <!-- Segmented Error Diagnostics -->
      <section v-if="segments.length > 0" class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-h4 font-bold mb-2">
          {{ appLocale === 'ru' ? 'Ошибка по сегментам' : 'Error by segment' }}
        </h2>
        <p class="text-caption text-text-muted mb-4">
          {{ appLocale === 'ru'
            ? 'Где модель систематически промахивается. Медиана/среднее = модель/факт (×1 — идеал, >1 — завышение). Помогает понять, какой фактор крутить, а не подбирать вслепую.'
            : 'Where the model is systematically off. Median/mean = model/real (×1 ideal, >1 over). Tells you which factor to tune instead of guessing.' }}
        </p>
        <AdminCalibrationSegmentsTable :app-locale="appLocale" :segments="segments" />
      </section>

      <!-- Real vs Model scatter + tails -->
      <section v-if="scorecard.length > 0" class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-h4 font-bold mb-4">
          {{ appLocale === 'ru' ? 'Факт против модели' : 'Real vs model' }}
        </h2>
        <AdminCalibrationScatter :app-locale="appLocale" :scorecard="scorecard" />
      </section>

      <!-- Manual pair demand inspector -->
      <AdminDemandPairLookup :app-locale="appLocale" />

      <!-- Scorecard Deviation Table -->
      <section v-if="scorecard.length > 0" class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-h4 font-bold mb-2">
          {{ t("scorecard") }}
        </h2>
        <p class="text-caption text-text-muted mb-4">
          {{ props.appLocale === 'ru' ? 'Сравнение расчетного пассажиропотока модели и реальных данных по парам.' : 'Model predicted daily passengers vs real data for benchmark pairs.' }}
        </p>
        <AdminCalibrationScorecardTable :app-locale="appLocale" :scorecard="scorecard" />
        <p v-if="scorecard.length > 150" class="text-caption text-text-muted mt-3 text-right">
          {{ props.appLocale === 'ru' ? `Показаны первые 150 записей из ${scorecard.length}` : `Showing first 150 rows out of ${scorecard.length}` }}
        </p>
      </section>
    </div>
    <div v-else-if="isLoading" class="mt-6 flex justify-center items-center py-12">
      <span class="text-text-muted">{{ adminText(props.appLocale, "loading") }}</span>
    </div>
    <div v-else class="mt-6 text-center py-12 border border-dashed border-border rounded-lg bg-surface-subtle/20">
      <p class="text-text-muted mb-4">
        {{ t("noCalibration") }}
      </p>
      <div class="flex justify-center gap-3">
        <AirButton :label="t('runQuick')" variant="success" @click="triggerCalibrate(false)" />
        <AirButton :label="t('runFull')" variant="warning" @click="triggerCalibrate(true)" />
      </div>
    </div>
  </section>
</template>
