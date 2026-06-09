<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";
import { Line } from "vue-chartjs";

import type { LedgerTransaction } from "../types";

import { chartPalette } from "./charts";

const props = defineProps<{ baseline: number; locale: Locale; transactions: LedgerTransaction[] }>();

const points = computed(() => {
  const sorted = [...props.transactions].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
  let running = props.baseline;

  return sorted.map((transaction) => {
    running += transaction.direction === "credit" ? transaction.amount : -transaction.amount;

    return { label: transaction.occurred_at, value: running };
  });
});

const chartData = computed(() => ({
  datasets: [
    {
      backgroundColor: chartPalette.primaryFill,
      borderColor: chartPalette.primary,
      borderWidth: 2,
      data: points.value.map((point) => point.value),
      fill: true,
      pointRadius: 0,
      tension: 0.3,
    },
  ],
  labels: points.value.map((point) =>
    new Intl.DateTimeFormat(props.locale, { day: "2-digit", month: "short" }).format(new Date(point.label)),
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
  <div class="h-56">
    <Line
      :data="chartData"
      :options="options"
    />
  </div>
</template>
