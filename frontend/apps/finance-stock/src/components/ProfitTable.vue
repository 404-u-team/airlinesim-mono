<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirDataTable, type AirDataTableColumn } from "@airlinesim/air-ui";
import { computed } from "vue";

export type ProfitRow = {
  costs: number;
  flights: number;
  id: string;
  label: string;
  profit: number;
  revenue: number;
};

const props = withDefaults(
  defineProps<{
    costsHeader: string;
    emptyText: string;
    flightsHeader: string;
    locale: Locale;
    nameHeader: string;
    pageSize?: number;
    profitHeader: string;
    revenueHeader: string;
    rows: ProfitRow[];
    title: string;
  }>(),
  { pageSize: 8 },
);

const columns = computed<AirDataTableColumn[]>(() => [
  { key: "label", label: props.nameHeader },
  { align: "right", key: "flights", label: props.flightsHeader },
  { align: "right", key: "revenue", label: props.revenueHeader },
  { align: "right", key: "costs", label: props.costsHeader },
  { align: "right", key: "profit", label: props.profitHeader },
]);

function formatMoney(value: unknown): string {
  return new Intl.NumberFormat(props.locale, { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(Number(value));
}
</script>

<template>
  <AirDataTable
    :columns="columns"
    :empty-text="emptyText"
    :page-size="pageSize"
    :rows="rows"
    :title="title"
  >
    <template #cell-revenue="{ value }">
      {{ formatMoney(value) }}
    </template>
    <template #cell-costs="{ value }">
      {{ formatMoney(value) }}
    </template>
    <template #cell-profit="{ value }">
      <span :class="Number(value) < 0 ? 'text-error' : 'text-success'">{{ formatMoney(value) }}</span>
    </template>
  </AirDataTable>
</template>
