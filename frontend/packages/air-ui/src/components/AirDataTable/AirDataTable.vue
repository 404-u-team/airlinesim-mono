<script setup lang="ts">
import { computed, ref, watch } from "vue";

import AirPagination from "../AirPagination/AirPagination.vue";

export type AirDataTableColumn = {
  align?: "left" | "right";
  key: string;
  label: string;
};

type Row = Record<string, unknown>;

const props = withDefaults(
  defineProps<{
    columns: AirDataTableColumn[];
    emptyText?: string;
    pageSize?: number;
    rowKey?: string;
    rows: Row[];
    title?: string;
  }>(),
  {
    emptyText: "No data",
    pageSize: 10,
    rowKey: "id",
    title: undefined,
  },
);

const page = ref(1);

const pageCount = computed(() => Math.max(1, Math.ceil(props.rows.length / props.pageSize)));
const pagedRows = computed(() =>
  props.rows.length > props.pageSize
    ? props.rows.slice((page.value - 1) * props.pageSize, page.value * props.pageSize)
    : props.rows,
);
const showPagination = computed(() => props.rows.length > props.pageSize);

watch(pageCount, (count) => {
  if (page.value > count) {
    page.value = count;
  }
});

function alignClass(column: AirDataTableColumn): string {
  return column.align === "right" ? "text-right" : "text-left";
}

function rowId(row: Row, index: number): string {
  const key = row[props.rowKey];

  return typeof key === "string" || typeof key === "number" ? String(key) : String(index);
}
</script>

<template>
  <section class="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
    <h2
      v-if="title"
      class="border-b border-border px-4 py-3 text-subtitle"
    >
      {{ title }}
    </h2>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-caption">
        <thead>
          <tr class="border-b border-border bg-surface-subtle text-text-muted">
            <th
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-2 font-medium"
              :class="alignClass(column)"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in pagedRows"
            :key="rowId(row, index)"
            class="border-b border-border last:border-b-0"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-4 py-2.5"
              :class="alignClass(column)"
            >
              <slot
                :name="`cell-${column.key}`"
                :column="column"
                :row="row"
                :value="row[column.key]"
              >
                {{ row[column.key] }}
              </slot>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td
              class="px-4 py-8 text-center text-text-muted"
              :colspan="columns.length"
            >
              {{ emptyText }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <AirPagination
      v-if="showPagination"
      :page="page"
      :page-size="pageSize"
      :total-items="rows.length"
      @update:page="page = $event"
    />
  </section>
</template>
