<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirSelect, AirTextField } from "@airlinesim/air-ui";
import { computed } from "vue";

import type { AdminEntityConfig, AdminFormValues, AdminSelectSource } from "../types";

import { adminText, localizeAdminLabel } from "../i18n";

type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

const props = defineProps<{
  appLocale: Locale;
  config: AdminEntityConfig;
  error: null | string;
  isEditing: boolean;
  isSubmitting: boolean;
  referenceOptions: Record<AdminSelectSource, SelectOption[]>;
  values: AdminFormValues;
}>();

const emit = defineEmits<{
  cancel: [];
  submit: [];
  "update:values": [values: AdminFormValues];
}>();

const title = computed(() => `${adminText(props.appLocale, props.isEditing ? "edit" : "create")} ${localizeAdminLabel(props.appLocale, props.config.title)}`);

function updateBoolean(key: string, event: Event): void {
  updateValue(key, (event.target as HTMLInputElement).checked ? "true" : "false");
}

function updateValue(key: string, value: string): void {
  emit("update:values", {
    ...props.values,
    [key]: value,
  });
}
</script>

<template>
  <form
    class="rounded-lg border border-border bg-surface p-4"
    @submit.prevent="emit('submit')"
  >
    <div class="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-h4 text-text-primary">
          {{ title }}
        </h2>
        <p class="mt-1 text-body text-text-muted">
          {{ adminText(appLocale, "technical") }}
        </p>
      </div>
      <div class="flex gap-2">
        <AirButton
          :label="adminText(appLocale, 'cancel')"
          size="sm"
          type="button"
          variant="primary-soft"
          @click="emit('cancel')"
        />
        <AirButton
          :label="adminText(appLocale, isEditing ? 'save' : 'create')"
          size="sm"
          type="submit"
          :disabled="isSubmitting"
        />
      </div>
    </div>

    <p
      v-if="error"
      class="mt-4 rounded-md bg-error-bg px-3 py-2 text-body text-text-primary"
    >
      {{ error }}
    </p>

    <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <template
        v-for="field in config.fields"
        :key="field.key"
      >
        <AirTextField
          v-if="field.kind === 'text' || field.kind === 'number'"
          :label="localizeAdminLabel(appLocale, field.label)"
          :model-value="values[field.key] ?? ''"
          :required="field.required"
          :type="field.kind === 'number' ? 'number' : 'text'"
          @update:model-value="updateValue(field.key, $event)"
        />

        <label
          v-else-if="field.kind === 'select' && field.selectSource"
          class="flex min-w-0 flex-col gap-1.5"
        >
          <span class="text-caption text-text-muted">
            {{ localizeAdminLabel(appLocale, field.label) }}
          </span>
          <AirSelect
            class="w-full"
            :label="localizeAdminLabel(appLocale, field.label)"
            :model-value="values[field.key] ?? ''"
            :options="referenceOptions[field.selectSource]"
            @update:model-value="updateValue(field.key, $event)"
          />
        </label>

        <label
          v-else
          class="flex min-h-16 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2"
        >
          <input
            class="size-4 accent-primary"
            type="checkbox"
            :checked="values[field.key] === 'true'"
            @change="updateBoolean(field.key, $event)"
          />
          <span class="text-body text-text-primary">
            {{ localizeAdminLabel(appLocale, field.label) }}
          </span>
        </label>
      </template>
    </div>
  </form>
</template>
