<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { ApiRequestError, createApiClient } from "@airlinesim/game-sdk";
import { computed, ref, watch } from "vue";

import type {
  AdminEntityConfig,
  AdminFormValues,
  AdminRecord,
  AdminSelectSource,
} from "../types";

import { authState } from "../../auth";
import { createOperationsAdminApi } from "../api/operationsAdminApi";
import { adminEntityConfigs } from "../data/entity-configs";
import { createEmptyFormValues, createFormValues, createPayload, validateForm } from "../form";
import AdminEntityForm from "./AdminEntityForm.vue";
import AdminRecordTable from "./AdminRecordTable.vue";

type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

const props = defineProps<{
  config: AdminEntityConfig;
}>();

const apiClient = createApiClient({
  getToken: () => authState.accessToken.value,
});
const adminApi = createOperationsAdminApi(apiClient);

const records = ref<AdminRecord[]>([]);
const countries = ref<AdminRecord[]>([]);
const regions = ref<AdminRecord[]>([]);
const formValues = ref<AdminFormValues>(createEmptyFormValues(props.config));
const selectedRecord = ref<AdminRecord | null>(null);
const error = ref<null | string>(null);
const notice = ref<null | string>(null);
const isLoading = ref(false);
const isSubmitting = ref(false);

const isEditing = computed(() => Boolean(selectedRecord.value?.id));
const referenceOptions = computed<Record<AdminSelectSource, SelectOption[]>>(() => ({
  countries: [
    { disabled: true, label: "Select country", value: "" },
    ...countries.value.map((country) => ({
      label: labelRecord(country, ["intl_name", "local_name", "iso"]),
      value: String(country.id ?? ""),
    })),
  ],
  regions: [
    { disabled: true, label: "Select region", value: "" },
    ...regions.value.map((region) => ({
      label: labelRecord(region, ["intl_name", "local_name", "local_code"]),
      value: String(region.id ?? ""),
    })),
  ],
}));

watch(
  () => props.config,
  async () => {
    resetForm();
    await loadPageData();
  },
  { immediate: true },
);

async function deleteRecord(record: AdminRecord): Promise<void> {
  if (!record.id) {
    return;
  }

  isSubmitting.value = true;
  error.value = null;
  notice.value = null;

  try {
    await adminApi.deleteRecord(props.config, record.id);
    notice.value = `${props.config.title} record deleted.`;
    resetForm();
    await loadPageData();
  } catch (deleteError) {
    error.value = getErrorMessage(deleteError);
  } finally {
    isSubmitting.value = false;
  }
}

function editRecord(record: AdminRecord): void {
  selectedRecord.value = record;
  formValues.value = createFormValues(props.config, record);
  error.value = null;
  notice.value = null;
}

function getErrorMessage(apiError: unknown): string {
  if (apiError instanceof ApiRequestError) {
    if (apiError.status === 401) {
      return "Authentication is required.";
    }

    if (apiError.status === 403) {
      return "Admin access is required.";
    }

    if (apiError.status === 409) {
      return "Record conflicts with existing data or dependencies.";
    }

    return apiError.message;
  }

  return "Request failed.";
}

function labelRecord(record: AdminRecord, keys: string[]): string {
  const labelValue = keys.map((key) => record[key]).find((value) => Boolean(value));

  return String(labelValue ?? record.id ?? "Unnamed");
}

async function loadPageData(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const [loadedRecords, loadedCountries, loadedRegions] = await Promise.all([
      adminApi.listRecords(props.config),
      loadReference("countries"),
      loadReference("regions"),
    ]);

    records.value = loadedRecords;
    countries.value = loadedCountries;
    regions.value = loadedRegions;
  } catch (loadError) {
    error.value = getErrorMessage(loadError);
  } finally {
    isLoading.value = false;
  }
}

async function loadReference(entityId: "countries" | "regions"): Promise<AdminRecord[]> {
  const config = adminEntityConfigs.find((entityConfig) => entityConfig.id === entityId);

  if (!config) {
    return [];
  }

  if (config.id === props.config.id) {
    return records.value;
  }

  return adminApi.listRecords(config);
}

function resetForm(): void {
  selectedRecord.value = null;
  formValues.value = createEmptyFormValues(props.config);
  error.value = null;
}

async function submitForm(): Promise<void> {
  const validationError = validateForm(props.config, formValues.value);

  if (validationError) {
    error.value = validationError;
    return;
  }

  isSubmitting.value = true;
  error.value = null;
  notice.value = null;

  try {
    const payload = createPayload(props.config, formValues.value);

    if (selectedRecord.value?.id) {
      await adminApi.updateRecord(props.config, selectedRecord.value.id, payload);
      notice.value = `${props.config.title} record updated.`;
    } else {
      await adminApi.createRecord(props.config, payload);
      notice.value = `${props.config.title} record created.`;
    }

    resetForm();
    await loadPageData();
  } catch (submitError) {
    error.value = getErrorMessage(submitError);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="min-h-0 overflow-y-auto p-4 sm:p-6">
    <div class="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <AirBadge
          label="OpenAPI enabled"
          variant="success-soft"
        />
        <h1 class="mt-4 text-h2 text-text-primary">
          {{ config.title }}
        </h1>
        <p class="mt-2 max-w-3xl text-body text-text-muted">
          {{ config.description }}
        </p>
      </div>
      <AirButton
        label="Refresh"
        size="sm"
        variant="primary-soft"
        :disabled="isLoading"
        @click="loadPageData"
      />
    </div>

    <div class="mt-5 grid gap-5">
      <p
        v-if="notice"
        class="rounded-md bg-success-bg px-3 py-2 text-body text-text-primary"
      >
        {{ notice }}
      </p>

      <AdminEntityForm
        v-model:values="formValues"
        :config="config"
        :error="error"
        :is-editing="isEditing"
        :is-submitting="isSubmitting"
        :reference-options="referenceOptions"
        @cancel="resetForm"
        @submit="submitForm"
      />

      <div>
        <div class="mb-3 flex items-center justify-between gap-4">
          <h2 class="text-h4 text-text-primary">
            Records
          </h2>
          <span class="text-caption text-text-muted">
            {{ isLoading ? "Loading..." : `${records.length} total` }}
          </span>
        </div>

        <AdminRecordTable
          :columns="config.columns"
          :records="records"
          @delete="deleteRecord"
          @edit="editRecord"
        />
      </div>
    </div>
  </section>
</template>
