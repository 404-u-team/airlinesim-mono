<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton } from "@airlinesim/air-ui";
import { computed, ref } from "vue";

import type { DemandPairResult } from "../types";

import { getDemandPair } from "../api/demandApi";

const props = defineProps<{ appLocale: Locale }>();
const ru = computed(() => props.appLocale === "ru");

const origin = ref("");
const destination = ref("");
const result = ref<DemandPairResult | null>(null);
const loading = ref(false);
const error = ref<null | string>(null);

// Factors to surface from the breakdown, in calculation order, with a plain-language
// note on what each does. Keys must match the demand breakdown shape from the BFF.
const FACTORS: { en: string; key: string; note_en: string; note_ru: string; ru: string }[] = [
  { en: "Origin catchment", key: "originCatchment", note_en: "People the origin market can draw on", note_ru: "Население рынка вылета", ru: "Catchment вылета" },
  { en: "Dest catchment", key: "destinationCatchment", note_en: "People the destination market can draw on", note_ru: "Население рынка прилёта", ru: "Catchment прилёта" },
  { en: "Gravity mass", key: "gravity", note_en: "catchment^α · GDPpc^β · distance decay", note_ru: "catchment^α · GDPpc^β · затухание расстояния", ru: "Гравитация" },
  { en: "Distance impedance", key: "distanceImpedance", note_en: "Distance decay (1 = near, →0 = far)", note_ru: "Затухание по расстоянию (1 = близко)", ru: "Импеданс расстояния" },
  { en: "Affinity factor", key: "affinityFactor", note_en: "Business + tourism + diaspora pull", note_ru: "Бизнес + туризм + диаспора", ru: "Фактор аффинности" },
  { en: "Propensity factor", key: "propensityFactor", note_en: "Per-country aviation propensity (calibrated)", note_ru: "Авиа-склонность стран (калибровка)", ru: "Фактор склонности" },
  { en: "Short-haul factor", key: "shortHaulFactor", note_en: "Collapses intra-metro / very short pairs", note_ru: "Гасит сверхкороткие/внутриметро пары", ru: "Короткие плечи" },
  { en: "Ground competition", key: "groundCompetition", note_en: "Rail/road & adjacent-airport substitution", note_ru: "Конкуренция ж/д/авто и соседних аэропортов", ru: "Наземная конкуренция" },
  { en: "Airport strength", key: "airportStrengthFactor", note_en: "Route viability from both airports' size", note_ru: "Жизнеспособность маршрута по силе аэропортов", ru: "Сила аэропортов" },
  { en: "Capacity share", key: "capacityShareFactor", note_en: "Metro→airport split (multi-airport cities)", note_ru: "Сплит метро→аэропорт (мультиаэропортовые города)", ru: "Доля ёмкости" },
  { en: "Override", key: "overrideMultiplier", note_en: "Manual per-pair correction (1 = none)", note_ru: "Ручная коррекция пары (1 = нет)", ru: "Override" },
  { en: "baseScale", key: "baseScale", note_en: "Global level from calibration", note_ru: "Глобальный уровень из калибровки", ru: "baseScale" },
];

const factorRows = computed(() => {
  const b = result.value?.breakdown;
  if (!b) { return []; }
  return FACTORS.filter((f) => f.key in b).map((f) => ({
    label: ru.value ? f.ru : f.en,
    note: ru.value ? f.note_ru : f.note_en,
    value: b[f.key],
  }));
});

function fmt(v: boolean | number | string | undefined): string {
  if (typeof v === "number") { return v >= 10000 ? Math.round(v).toLocaleString() : String(v); }
  return String(v);
}

async function lookup(): Promise<void> {
  const o = origin.value.trim().toUpperCase();
  const d = destination.value.trim().toUpperCase();
  if (!o || !d || o === d) { error.value = ru.value ? "Укажите два разных IATA-кода" : "Enter two different IATA codes"; return; }
  loading.value = true; error.value = null;
  try {
    result.value = await getDemandPair(o, d);
  } catch {
    error.value = ru.value ? `Не удалось рассчитать ${o}–${d} (аэропорт не найден?)` : `Could not compute ${o}–${d} (airport not found?)`;
    result.value = null;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-h4 font-bold mb-2">
      {{ ru ? 'Расчёт спроса по паре' : 'Inspect pair demand' }}
    </h2>
    <p class="text-caption text-text-muted mb-4">
      {{ ru ? 'Введите IATA-коды, чтобы увидеть рассчитанный спрос и как он сложился из факторов модели.' : 'Enter IATA codes to see the modelled demand and how each factor produced it.' }}
    </p>

    <div class="flex flex-wrap items-end gap-2">
      <label class="flex flex-col text-caption text-text-muted">
        {{ ru ? 'Вылет' : 'Origin' }}
        <input
          v-model="origin"
          class="mt-1 w-24 rounded-md border border-border bg-background px-2 py-1.5 text-body uppercase text-text-primary"
          maxlength="3"
          placeholder="FRA"
          @keyup.enter="lookup"
        />
      </label>
      <label class="flex flex-col text-caption text-text-muted">
        {{ ru ? 'Прилёт' : 'Destination' }}
        <input
          v-model="destination"
          class="mt-1 w-24 rounded-md border border-border bg-background px-2 py-1.5 text-body uppercase text-text-primary"
          maxlength="3"
          placeholder="JFK"
          @keyup.enter="lookup"
        />
      </label>
      <AirButton
        :disabled="loading"
        :label="loading ? '…' : (ru ? 'Рассчитать' : 'Compute')"
        size="sm"
        variant="primary"
        @click="lookup"
      />
    </div>

    <p v-if="error" class="mt-3 text-body text-error">
      {{ error }}
    </p>

    <div v-if="result" class="mt-4 space-y-4">
      <div class="flex flex-wrap gap-4">
        <div class="rounded-md border border-border bg-surface-subtle px-4 py-3">
          <div class="text-caption text-text-muted">
            {{ result.originIata }} → {{ result.destinationIata }}
          </div>
          <div class="text-h3 font-bold">
            {{ result.originDailyPassengers.toLocaleString() }}<span class="text-caption font-normal text-text-muted"> {{ ru ? 'пасс./день' : 'pax/day' }}</span>
          </div>
        </div>
        <div class="rounded-md border border-border bg-surface-subtle px-4 py-3">
          <div class="text-caption text-text-muted">
            {{ result.destinationIata }} → {{ result.originIata }}
          </div>
          <div class="text-h3 font-bold">
            {{ result.destinationDailyPassengers.toLocaleString() }}<span class="text-caption font-normal text-text-muted"> {{ ru ? 'пасс./день' : 'pax/day' }}</span>
          </div>
        </div>
        <div class="rounded-md border border-border bg-surface-subtle px-4 py-3">
          <div class="text-caption text-text-muted">
            {{ ru ? 'Расстояние' : 'Distance' }}
          </div>
          <div class="text-h3 font-bold">
            {{ result.distanceKm.toLocaleString() }} <span class="text-caption font-normal text-text-muted">km</span>
          </div>
        </div>
      </div>

      <table class="w-full text-body">
        <thead>
          <tr class="border-b border-border text-text-muted text-caption uppercase">
            <th class="py-2 px-3 text-left">
              {{ ru ? 'Фактор' : 'Factor' }}
            </th>
            <th class="py-2 px-3 text-right">
              {{ ru ? 'Значение' : 'Value' }}
            </th>
            <th class="py-2 px-3 text-left">
              {{ ru ? 'Что делает' : 'What it does' }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr v-for="row in factorRows" :key="row.label">
            <td class="py-1.5 px-3 font-medium">
              {{ row.label }}
            </td>
            <td class="py-1.5 px-3 text-right font-mono font-semibold">
              {{ fmt(row.value) }}
            </td>
            <td class="py-1.5 px-3 text-caption text-text-muted">
              {{ row.note }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
