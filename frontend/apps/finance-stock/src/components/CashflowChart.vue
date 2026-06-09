<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";
import { Bar } from "vue-chartjs";

import type { LedgerTransaction } from "../types";

import { chartPalette } from "./charts";

const props = defineProps<{
  costsLabel: string;
  locale: Locale;
  revenueLabel: string;
  transactions: LedgerTransaction[];
}>();

const days = computed(() => {
  const byDay = new Map<string, { costs: number; revenue: number }>();

  for (const transaction of props.transactions) {
    const day = transaction.occurred_at.slice(0, 10);
    const bucket = byDay.get(day) ?? { costs: 0, revenue: 0 };
    if (transaction.direction === "credit") {
      bucket.revenue += transaction.amount;
    } else {
      bucket.costs += transaction.amount;
    }
    byDay.set(day, bucket);
  }

  return [...byDay.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .slice(-14)
    .map(([day, bucket]) => ({ ...bucket, day }));
});

const chartData = computed(() => ({
  datasets: [
    {
      backgroundColor: chartPalette.profit,
      borderRadius: 3,
      data: days.value.map((entry) => entry.revenue),
      label: props.revenueLabel,
    },
    {
      backgroundColor: chartPalette.loss,
      borderRadius: 3,
      data: days.value.map((entry) => entry.costs),
      label: props.costsLabel,
    },
  ],
  labels: days.value.map((entry) =>
    new Intl.DateTimeFormat(props.locale, { day: "2-digit", month: "short" }).format(new Date(entry.day)),
  ),
}));

const options = computed(() => ({
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: chartPalette.ticks }, position: "bottom" as const } },
  responsive: true,
  scales: {
    x: { grid: { display: false }, ticks: { autoSkip: true, color: chartPalette.ticks, maxRotation: 0, maxTicksLimit: 7 } },
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
    <Bar
      :data="chartData"
      :options="options"
    />
  </div>
</template>
