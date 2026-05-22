<script setup lang="ts">
import { AirButton } from "@airlinesim/air-ui";

import type { AdminColumn, AdminRecord } from "../types";

defineProps<{
  columns: AdminColumn[];
  records: AdminRecord[];
}>();

const emit = defineEmits<{
  delete: [record: AdminRecord];
  edit: [record: AdminRecord];
}>();

function formatCell(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border bg-surface">
    <div class="overflow-x-auto">
      <table class="min-w-full border-collapse text-left">
        <thead class="bg-surface-subtle text-caption text-text-muted">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="whitespace-nowrap px-4 py-3 font-normal"
            >
              {{ column.label }}
            </th>
            <th class="w-64 px-4 py-3 font-normal">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border text-body text-text-primary">
          <tr v-if="records.length === 0">
            <td
              :colspan="columns.length + 1"
              class="px-4 py-8 text-center text-text-muted"
            >
              No records returned by the API.
            </td>
          </tr>
          <tr
            v-for="record in records"
            :key="record.id ?? JSON.stringify(record)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              class="max-w-64 truncate px-4 py-3"
              :title="formatCell(record[column.key])"
            >
              {{ formatCell(record[column.key]) }}
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-2">
                <AirButton
                  label="Edit"
                  size="sm"
                  variant="primary-soft"
                  @click="emit('edit', record)"
                />
                <AirButton
                  label="Delete"
                  size="sm"
                  variant="danger-soft"
                  :disabled="!record.id"
                  @click="emit('delete', record)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
