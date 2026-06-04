<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton } from "@airlinesim/air-ui";

import type { AdminColumn, AdminRecord } from "../types";

import { adminText, localizeAdminLabel } from "../i18n";

defineProps<{
  appLocale: Locale;
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
    <div class="divide-y divide-border sm:hidden">
      <p v-if="records.length === 0" class="p-5 text-center text-text-muted">
        {{ adminText(appLocale, "empty") }}
      </p>
      <article v-for="record in records" :key="record.id ?? JSON.stringify(record)" class="p-4">
        <dl class="grid gap-2">
          <div v-for="column in columns" :key="column.key" class="min-w-0">
            <dt class="text-caption text-text-muted">
              {{ localizeAdminLabel(appLocale, column.label) }}
            </dt>
            <dd class="break-words text-body">
              {{ formatCell(record[column.key]) }}
            </dd>
          </div>
        </dl>
        <div class="mt-4 flex gap-2">
          <AirButton
            :label="adminText(appLocale, 'edit')"
            size="sm"
            variant="primary-soft"
            @click="emit('edit', record)"
          />
          <AirButton
            :disabled="!record.id"
            :label="adminText(appLocale, 'delete')"
            size="sm"
            variant="danger-soft"
            @click="emit('delete', record)"
          />
        </div>
      </article>
    </div>
    <div class="hidden overflow-x-auto sm:block">
      <table class="min-w-full border-collapse text-left">
        <thead class="bg-surface-subtle text-caption text-text-muted">
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              class="whitespace-nowrap px-4 py-3 font-normal"
            >
              {{ localizeAdminLabel(appLocale, column.label) }}
            </th>
            <th class="w-64 px-4 py-3 font-normal">
              {{ adminText(appLocale, "actions") }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border text-body text-text-primary">
          <tr v-if="records.length === 0">
            <td
              :colspan="columns.length + 1"
              class="px-4 py-8 text-center text-text-muted"
            >
              {{ adminText(appLocale, "empty") }}
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
                  :label="adminText(appLocale, 'edit')"
                  size="sm"
                  variant="primary-soft"
                  @click="emit('edit', record)"
                />
                <AirButton
                  :label="adminText(appLocale, 'delete')"
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
