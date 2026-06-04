<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import type { WorldReadiness } from "../readiness-types";

import { getLatestImportJob, type LatestImportJob } from "../api/importApi";
import { getWorldReadiness } from "../api/readinessApi";

const props = defineProps<{ appLocale: Locale }>();
const readiness = ref<null | WorldReadiness>(null);
const error = ref("");
const isLoading = ref(false);
const latestImport = ref<LatestImportJob | null>(null);
const router = useRouter();
const messages = {
  en: {
    airports: "Airports",
    blockers: "Blockers", countries: "Countries", description: "Checks whether a new player can complete the first airline cycle with current world data.", empty: "No issues found.", error: "Readiness is unavailable.",
    latestImport: "Latest import",
    noImport: "No import jobs in this process",
    refresh: "Refresh readiness",
    regionLinks: "Region links",
    regions: "Regions",
    title: "World readiness",
    warnings: "Warnings",
  },
  ru: {
    airports: "Аэропорты",
    blockers: "Блокеры", countries: "Страны", description: "Проверка, может ли новый игрок пройти первый игровой цикл на текущих данных мира.", empty: "Проблем не найдено.", error: "Проверка готовности недоступна.",
    latestImport: "Последний импорт",
    noImport: "В этом процессе импорт ещё не запускался",
    refresh: "Обновить проверку",
    regionLinks: "Связи регионов",
    regions: "Регионы",
    title: "Готовность мира",
    warnings: "Предупреждения",
  },
};
const issueMessages: Record<string, Record<Locale, string>> = {
  AIRPORT_DATA_INCOMPLETE: { en: "Airport operational data is incomplete.", ru: "Операционные данные аэропорта неполны." },
  AIRPORT_REFERENCE_INVALID: { en: "Airport country or region reference is invalid.", ru: "Связь аэропорта со страной или регионом некорректна." },
  AIRPORTS_INSUFFICIENT: { en: "At least two usable airports are required.", ru: "Требуется минимум два пригодных аэропорта." },
  COUNTRIES_EMPTY: { en: "No countries exist.", ru: "Страны отсутствуют." },
  COUNTRY_ISO_INVALID: { en: "Country ISO code is missing, invalid, or duplicated.", ru: "ISO-код страны отсутствует, некорректен или дублируется." },
  PRODUCT_NO_COMPATIBLE_AIRCRAFT: { en: "No aircraft type is compatible with a usable airport.", ru: "Нет типа самолета, совместимого с пригодным аэропортом." },
  PRODUCT_NO_ROUTE_OPPORTUNITY: { en: "No first route opportunity can be built.", ru: "Нельзя построить первое маршрутное направление." },
  REGION_DATA_INVALID: { en: "Region reference or demand data is invalid.", ru: "Связь региона или данные спроса некорректны." },
  REGION_LINK_INVALID: { en: "Region link is invalid or duplicated.", ru: "Связь регионов некорректна или дублируется." },
  REGION_LINKS_EMPTY: { en: "No region links exist.", ru: "Связи регионов отсутствуют." },
  REGIONS_EMPTY: { en: "No regions exist.", ru: "Регионы отсутствуют." },
};

onMounted(() => void load());

function issueText(code: string): string {
  return issueMessages[code]?.[props.appLocale] ?? code;
}

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    [readiness.value, latestImport.value] = await Promise.all([getWorldReadiness(), getLatestImportJob()]);
  } catch {
    error.value = messages[props.appLocale].error;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <section class="h-full overflow-y-auto p-4 sm:p-6">
    <AirBadge :label="readiness?.status ?? '...'" :variant="readiness?.status === 'ready' ? 'success-soft' : readiness?.status === 'blocked' ? 'danger-soft' : 'warning-soft'" />
    <h1 class="mt-4 text-h2">
      {{ messages[appLocale].title }}
    </h1>
    <p class="mt-2 max-w-3xl text-text-muted">
      {{ messages[appLocale].description }}
    </p>
    <AirButton
      class="mt-4"
      :disabled="isLoading"
      :label="messages[appLocale].refresh"
      size="sm"
      @click="load"
    />
    <p v-if="error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
      {{ error }}
    </p>

    <div v-if="readiness" class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AirMetricCard :label="messages[appLocale].countries" :value="String(readiness.counts.countries)" />
      <AirMetricCard :label="messages[appLocale].regions" :value="String(readiness.counts.regions)" />
      <AirMetricCard :label="messages[appLocale].airports" :value="String(readiness.counts.airports)" />
      <AirMetricCard :label="messages[appLocale].regionLinks" :value="String(readiness.counts.region_links)" />
    </div>
    <section v-if="readiness" class="mt-5 rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ messages[appLocale].latestImport }}
      </h2>
      <p class="mt-2 break-all text-text-muted">
        {{ latestImport ? `${latestImport.mode} · ${latestImport.status} · ${latestImport.id}` : messages[appLocale].noImport }}
      </p>
    </section>

    <div v-if="readiness" class="mt-5 grid gap-5 xl:grid-cols-2">
      <section class="rounded-lg border border-error bg-surface p-4">
        <h2 class="text-subtitle">
          {{ messages[appLocale].blockers }} · {{ readiness.blockers.length }}
        </h2>
        <p v-if="readiness.blockers.length === 0" class="mt-3 text-text-muted">
          {{ messages[appLocale].empty }}
        </p>
        <button
          v-for="issue in readiness.blockers"
          :key="`${issue.code}-${issue.entity_id}`"
          class="mt-3 block w-full rounded-lg border border-border p-3 text-left hover:bg-surface-subtle"
          type="button"
          @click="router.push(issue.target_path)"
        >
          <strong>{{ issueText(issue.code) }}</strong>
          <span v-if="issue.entity_label" class="mt-1 block text-caption text-text-muted">{{ issue.entity_label }}</span>
        </button>
      </section>
      <section class="rounded-lg border border-warning bg-surface p-4">
        <h2 class="text-subtitle">
          {{ messages[appLocale].warnings }} · {{ readiness.warnings.length }}
        </h2>
        <p v-if="readiness.warnings.length === 0" class="mt-3 text-text-muted">
          {{ messages[appLocale].empty }}
        </p>
        <button
          v-for="issue in readiness.warnings"
          :key="issue.code"
          class="mt-3 block w-full rounded-lg border border-border p-3 text-left hover:bg-surface-subtle"
          type="button"
          @click="router.push(issue.target_path)"
        >
          {{ issueText(issue.code) }}
        </button>
      </section>
    </div>
  </section>
</template>
