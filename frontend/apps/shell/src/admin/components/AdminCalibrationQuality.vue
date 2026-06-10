<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirMetricCard, AirModal } from "@airlinesim/air-ui";
import { computed, ref } from "vue";

import type { CalibrationArtifact } from "../types";

const props = defineProps<{ anchorsUsed: number; appLocale: Locale; artifact: CalibrationArtifact }>();
const ru = computed(() => props.appLocale === "ru");
const q = computed(() => props.artifact.quality);

const r2Formatted = computed(() => (typeof q.value?.r2 === "number" ? `${(q.value.r2 * 100).toFixed(2)}%` : "—"));
// Backend returns MAPE as a fraction (0.15 = 15%); render it as a percent once.
const mapeFormatted = computed(() => (typeof q.value?.mape === "number" ? `${(q.value.mape * 100).toFixed(1)}%` : "—"));
const medianRatioFormatted = computed(() => (typeof q.value?.medianRatio === "number" ? `×${q.value.medianRatio.toFixed(2)}` : "—"));
const biasFormatted = computed(() => (typeof q.value?.bias === "number" ? `×${q.value.bias.toFixed(2)}` : "—"));
const pairsValue = computed(() => {
  if (q.value?.pairs) { return String(q.value.pairs); }
  return props.anchorsUsed > 0 ? String(props.anchorsUsed) : "—";
});
const fittedAt = computed(() => (props.artifact.fittedAt ? new Date(props.artifact.fittedAt).toLocaleString(props.appLocale) : "—"));
// Typical multiplicative error: exp(median|log(model/real)|), with p90 for the tail.
const logErrorFormatted = computed(() => {
  const m = q.value?.medianAbsLogError; const p90 = q.value?.p90AbsLogError;
  if (typeof m !== "number") { return "—"; }
  return typeof p90 === "number" ? `×${Math.exp(m).toFixed(2)} (p90 ×${Math.exp(p90).toFixed(1)})` : `×${Math.exp(m).toFixed(2)}`;
});

// R² is goodness-of-fit: only a clearly positive value is good; negative ⇒ worse
// than predicting the mean, so it must never read as success.
const r2Tone = computed(() => {
  const r2 = q.value?.r2;
  if (typeof r2 !== "number") { return "neutral"; }
  if (r2 >= 0.3) { return "success"; }
  return r2 > 0 ? "warning" : "danger";
});
const mapeTone = computed(() => (typeof q.value?.mape === "number" && q.value.mape < 0.25 ? "success" : "warning"));
const medianTone = computed(() => {
  const m = q.value?.medianRatio;
  if (typeof m !== "number") { return "neutral"; }
  return m >= 0.7 && m <= 1.5 ? "success" : "warning";
});

// Info Modal State
const activeMetric = ref<null | string>(null);

const METRIC_INFO: Record<string, { en: { explanation: string; title: string; }; ru: { explanation: string; title: string; } }> = {
  bias: {
    en: {
      explanation: "A measure of systematic overprediction or underprediction in the model.\n\nAn ideal value is ×1.0 (unbiased). If systematic bias is above ×1.0, the model tends to systematically overestimate passenger flow. If below ×1.0, it systematically underestimates it.",
      title: "Systematic Bias",
    },
    ru: {
      explanation: "Показатель систематического завышения или занижения прогнозов модели.\n\nИдеальное значение — ×1.0 (несмещенная оценка). Если показатель выше ×1.0, модель склонна систематически переоценивать объемы перевозок; если ниже ×1.0 — недооценивать.",
      title: "Системный сдвиг",
    },
  },
  logError: {
    en: {
      explanation: "The typical multiplicative error factor, calculated in log-space to handle high orders of magnitude variance.\n\n×1.5 means that predictions are typically within 1.5x of actual values (either 50% above or 33% below). The p90 value represents the error threshold for 90% of all pairs (excluding the worst 10% outliers).",
      title: "Typical Error (Log-space)",
    },
    ru: {
      explanation: "Типичный мультипликативный фактор ошибки, рассчитанный в логарифмическом пространстве для адекватного учета разницы в порядках величин.\n\nЗначение ×1.5 означает, что прогноз обычно отличается от факта не более чем в 1.5 раза (на 50% больше или на 33% меньше). Значение p90 показывает предел ошибки для 90% всех пар (исключая 10% худших выбросов).",
      title: "Типичная ошибка (log)",
    },
  },
  mape: {
    en: {
      explanation: "The average absolute percentage error across all calibrated pairs.\n\nBecause MAPE divides by the actual value, it is heavily skewed and inflated by thin routes (where a small difference in passenger count leads to a huge percentage error). However, it remains a useful metric for general error scaling.",
      title: "MAPE (Mean Absolute Percentage Error)",
    },
    ru: {
      explanation: "Среднее отношение абсолютной ошибки к фактическим значениям по всем парам.\n\nИз-за деления на фактическое значение этот показатель сильно завышается тонкими маршрутами (где даже небольшая разница в пассажирах дает огромную ошибку в процентах). Тем не менее, MAPE полезен для общей оценки масштаба погрешностей.",
      title: "MAPE (Средняя абсолютная процентная ошибка)",
    },
  },
  medianRatio: {
    en: {
      explanation: "The median ratio of the model's predicted passenger flow to the actual passenger flow.\n\nA value of ×1.0 represents a perfect median fit. A value of ×1.5 means that in 50% of cases, the model overpredicts traffic by 1.5 times or more, while ×0.7 means it underpredicts by 30% or more.",
      title: "Median Model/Real Ratio",
    },
    ru: {
      explanation: "Медианное отношение прогнозного пассажиропотока модели к фактическому.\n\nЗначение ×1.0 означает идеальное попадание по медиане. Значение ×1.5 указывает на то, что в половине случаев модель завышает поток в 1.5 раза и более, а ×0.7 — занижает на 30% и более.",
      title: "Медиана модель/факт",
    },
  },
  pairs: {
    en: {
      explanation: "The number of airport-to-airport passenger flow pairs (Eurostat/BTS database anchors) used to calibrate the model.\n\nA higher number of anchors provides more representative calibration data for regression, helping build a more balanced passenger demand gravity model.",
      title: "Pairs Used (Anchors)",
    },
    ru: {
      explanation: "Количество направлений пассажиропотока (якорей из баз Eurostat/BTS), использованных для калибровки модели.\n\nБольшее количество якорей обеспечивает более репрезентативные данные для регрессии, что помогает построить сбалансированную гравитационную модель спроса.",
      title: "Пар использовано (Якоря)",
    },
  },
  r2: {
    en: {
      explanation: "R-squared coefficient of determination, measuring how much of the variance in actual passenger flows is explained by the gravity model.\n\nSince passenger demand depends heavily on real-world geography and historical networks, gravity models are structurally capped (typically around R² ≈ 0.30 to 0.40). Positive values indicate the model performs better than predicting a simple average.",
      title: "R² (Goodness of Fit)",
    },
    ru: {
      explanation: "Показывает долю дисперсии реального пассажиропотока, объясняемую гравитационной моделью.\n\nПоскольку спрос сильно зависит от географических особенностей и исторических связей, для гравитационных моделей этот коэффициент ограничен (типичные значения R² ≈ 0.30 - 0.40). Положительное значение означает, что модель работает лучше, чем прогнозирование простого среднего. Предел нашей модели при имеющихся данный около R² ≈ -0.04, что не является плохим результатом для симуляции в мире, не привязанном к реальным событиям и ограничениям. (Так как сравнение происходит с данными Евростата, а мы покрываем моделью весь мир)",
      title: "R² (Коэффициент детерминации)",
    },
  },
};

const activeMetricInfo = computed(() => {
  if (!activeMetric.value) { return null; }
  const info = METRIC_INFO[activeMetric.value];
  if (!info) { return null; }
  return props.appLocale === "ru" ? info.ru : info.en;
});
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4">
    <h2 class="text-h4 font-bold mb-4">
      {{ ru ? 'Качество калибровки' : 'Calibration quality' }}
    </h2>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AirMetricCard :label="ru ? 'Версия' : 'Version'" :value="String(artifact.version)" />
      <AirMetricCard :label="ru ? 'Откалибровано' : 'Fitted at'" :value="fittedAt" />
      <AirMetricCard
        :label="ru ? 'Пар использовано' : 'Pairs used'"
        :value="pairsValue"
        :info-label="ru ? 'Инфо' : 'Info'"
        @info="activeMetric = 'pairs'"
      />
      <AirMetricCard
        label="R² (Goodness of Fit)"
        :value="r2Formatted"
        :tone="r2Tone"
        :info-label="ru ? 'Инфо' : 'Info'"
        @info="activeMetric = 'r2'"
      />
      <AirMetricCard
        label="MAPE (Avg Error)"
        :value="mapeFormatted"
        :tone="mapeTone"
        :info-label="ru ? 'Инфо' : 'Info'"
        @info="activeMetric = 'mape'"
      />
      <AirMetricCard
        :label="ru ? 'Медиана модель/факт' : 'Median model/real'"
        :value="medianRatioFormatted"
        :tone="medianTone"
        :info-label="ru ? 'Инфо' : 'Info'"
        @info="activeMetric = 'medianRatio'"
      />
      <AirMetricCard
        :label="ru ? 'Системный сдвиг' : 'Systematic bias'"
        :value="biasFormatted"
        :tone="medianTone"
        :info-label="ru ? 'Инфо' : 'Info'"
        @info="activeMetric = 'bias'"
      />
      <AirMetricCard
        :label="ru ? 'Типичная ошибка (log)' : 'Typical error (log)'"
        :value="logErrorFormatted"
        tone="neutral"
        :info-label="ru ? 'Инфо' : 'Info'"
        @info="activeMetric = 'logError'"
      />
    </div>
    <p class="mt-3 text-caption text-text-muted">
      {{ ru
        ? 'MAPE раздувают тонкие маршруты; медиана, сдвиг и log-ошибка устойчивее: ×1.0 — в среднем точно, ×3 — завышение втрое. R² ограничен потолком гравитации (corr≈0.53).'
        : 'MAPE is inflated by thin routes; median, bias & log-error are robust: ×1.0 on-target, ×3 = 3× over. R² is capped by the gravity ceiling (corr≈0.53).' }}
    </p>

    <!-- Info Modal -->
    <AirModal :open="Boolean(activeMetric)" :title="activeMetricInfo?.title" @close="activeMetric = null">
      <div class="space-y-4 text-body text-text-primary whitespace-pre-line">
        <p>{{ activeMetricInfo?.explanation }}</p>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <AirButton :label="ru ? 'Закрыть' : 'Close'" size="sm" @click="activeMetric = null" />
        </div>
      </template>
    </AirModal>
  </section>
</template>
