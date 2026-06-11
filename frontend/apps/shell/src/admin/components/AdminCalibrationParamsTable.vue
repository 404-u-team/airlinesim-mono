<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";

import type { CalibrationParams } from "../types";

const props = defineProps<{ appLocale: Locale; params: CalibrationParams }>();
const ru = computed(() => props.appLocale === "ru");

// Each parameter with its value formatter and a plain-language note on what it does
// AND which way it pushes demand — so an operator knows which knob to turn.
type Row = { en: string; fmt: (p: CalibrationParams) => string; key: string; ru: string };
const ROWS: Row[] = [
  { en: "Global level multiplier (fitted). ↑ scales every route up; set by calibration so the median pair lands on target.", fmt: (p) => p.baseScale.toFixed(3), key: "baseScale", ru: "Глобальный множитель уровня (подбирается). ↑ поднимает все маршруты; задаётся калибровкой так, чтобы медианная пара попадала в цель." },
  { en: "Exponent on catchment population. ↑ steepens big↔small contrast (trunk up, thin down) but inflates variance — kept moderate on purpose.", fmt: (p) => p.populationElasticity.toFixed(3), key: "populationElasticity", ru: "Показатель степени по населению catchment. ↑ усиливает контраст крупные↔мелкие (trunk вверх, тонкие вниз), но раздувает дисперсию — держим умеренным намеренно." },
  { en: "Exponent on GDP per capita. ↑ favours wealthy markets.", fmt: (p) => p.gdpElasticity.toFixed(3), key: "gdpElasticity", ru: "Показатель степени по ВВП на душу. ↑ усиливает богатые рынки." },
  { en: "Distance half-decay scale. ↑ flattens the curve (more long-haul demand). Raised 1800→2500 to fix long-haul under-prediction.", fmt: (p) => `${p.distanceD0} km`, key: "distanceD0", ru: "Масштаб полузатухания по расстоянию. ↑ уплощает кривую (больше дальнего спроса). Поднят 1800→2500, чтобы починить недооценку дальних." },
  { en: "Distance decay power. ↑ sharpens the drop-off with distance. Lowered 1.25→1.0 alongside D0.", fmt: (p) => p.distanceP.toFixed(2), key: "distanceP", ru: "Степень затухания по расстоянию. ↑ делает спад с расстоянием резче. Снижен 1.25→1.0 вместе с D0." },
  { en: "Baseline affinity when no business/tourism/diaspora pull applies.", fmt: (p) => p.affinityBase.toFixed(2), key: "affinityBase", ru: "Базовая аффинность, когда нет бизнес/туризм/диаспора-притяжения." },
  { en: "Weight of business affinity. ↑ lifts business-heavy city pairs.", fmt: (p) => p.affinityBusiness.toFixed(2), key: "affinityBusiness", ru: "Вес бизнес-аффинности. ↑ поднимает деловые пары городов." },
  { en: "Weight of tourism affinity. ↑ lifts leisure destinations.", fmt: (p) => p.affinityTourism.toFixed(2), key: "affinityTourism", ru: "Вес туристической аффинности. ↑ поднимает курортные направления." },
  { en: "Weight of diaspora/migrant-corridor affinity (VFR traffic).", fmt: (p) => p.affinityDiaspora.toFixed(2), key: "affinityDiaspora", ru: "Вес диаспора/миграционной аффинности (поездки к родне)." },
];

const rows = computed(() => ROWS.map((r) => ({ desc: ru.value ? r.ru : r.en, key: r.key, value: r.fmt(props.params) })));
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-left text-body">
      <thead>
        <tr class="border-b border-border text-text-muted text-caption uppercase">
          <th class="py-2 px-3">
            {{ ru ? 'Параметр' : 'Parameter' }}
          </th>
          <th class="py-2 px-3 text-right">
            {{ ru ? 'Значение' : 'Value' }}
          </th>
          <th class="py-2 px-3">
            {{ ru ? 'Что делает' : 'What it does' }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <tr v-for="row in rows" :key="row.key">
          <td class="py-2 px-3 font-mono text-primary font-medium align-top">
            {{ row.key }}
          </td>
          <td class="py-2 px-3 text-right font-semibold align-top">
            {{ row.value }}
          </td>
          <td class="py-2 px-3 text-text-muted text-caption">
            {{ row.desc }}
          </td>
        </tr>
      </tbody>
    </table>
    <p class="mt-3 px-3 text-caption text-text-muted">
      {{ ru
        ? 'Не в этой таблице: сила аэропортов (capacityIndex), наземная конкуренция и метро-сплит — структурные множители в коде, симметричные в калибровке и runtime.'
        : 'Not shown here: airport strength (capacityIndex), ground competition and metro split — structural multipliers in code, applied symmetrically in calibration and runtime.' }}
    </p>
  </div>
</template>
