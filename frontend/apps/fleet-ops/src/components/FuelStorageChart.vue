<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";
import { Line } from "vue-chartjs";

import type { FuelStorageHistoryEntry } from "../types";

import { chartPalette } from "./charts";

const props = defineProps<{ history: FuelStorageHistoryEntry[]; locale: Locale }>();

const points = computed(() => [...props.history].slice(0, 96).reverse());

const chartData = computed(() => ({
  datasets: [
    {
      backgroundColor: chartPalette.primaryFill,
      borderColor: chartPalette.primary,
      borderWidth: 2,
      data: points.value.map((point) => point.stored_tonnes),
      fill: true,
      pointRadius: 0,
      stepped: true,
    },
  ],
  labels: points.value.map((point) =>
    new Intl.DateTimeFormat(props.locale, { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "2-digit" }).format(new Date(point.recorded_at)),
  ),
}));

const options = computed(() => ({
  interaction: { intersect: false, mode: "index" as const },
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  responsive: true,
  scales: {
    x: {
      grid: { color: chartPalette.grid },
      ticks: { autoSkip: true, color: chartPalette.ticks, maxRotation: 0, maxTicksLimit: 6 },
    },
    y: {
      beginAtZero: true,
      grid: { color: chartPalette.grid },
      ticks: {
        callback: (value: number | string) =>
          new Intl.NumberFormat(props.locale, { maximumFractionDigits: 0, notation: "compact" }).format(Number(value)),
        color: chartPalette.ticks,
      },
    },
  },
}));
</script>

<template>
  <div class="h-72">
    <Line
      :data="chartData"
      :options="options"
    />
  </div>
</template>
