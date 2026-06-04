<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

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
import { adminText, localizeAdminLabel } from "../i18n";
import AdminEntityForm from "./AdminEntityForm.vue";
import AdminRecordTable from "./AdminRecordTable.vue";

type SelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

const props = defineProps<{
  appLocale: Locale;
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
const pendingDelete = ref<AdminRecord | null>(null);
const pendingDiscard = ref(false);
const search = ref("");
const formSnapshot = ref("");

const isEditing = computed(() => Boolean(selectedRecord.value?.id));
const isDirty = computed(() => JSON.stringify(formValues.value) !== formSnapshot.value);
const filteredRecords = computed(() => {
  const query = search.value.trim().toLowerCase();

  return (query
    ? records.value.filter((record) => recordMatches(record, query))
    : records.value).slice(0, 500);
});
const availableRegions = computed(() => props.config.id === "airports" && formValues.value.country_id
  ? regions.value.filter((region) => region.country_id === formValues.value.country_id)
  : regions.value);
const referenceOptions = computed<Record<AdminSelectSource, SelectOption[]>>(() => ({
  countries: [
    { disabled: true, label: adminText(props.appLocale, "selectCountry"), value: "" },
    ...countries.value.map((country) => ({
      label: labelRecord(country, ["intl_name", "local_name", "iso"]),
      value: String(country.id ?? ""),
    })),
  ],
  regions: [
    { disabled: true, label: adminText(props.appLocale, "selectRegion"), value: "" },
    ...availableRegions.value.map((region) => ({
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

  if (pendingDelete.value?.id !== record.id) {
    pendingDelete.value = record;
    return;
  }
  pendingDelete.value = null;

  isSubmitting.value = true;
  error.value = null;
  notice.value = null;

  try {
    await adminApi.deleteRecord(props.config, record.id);
    notice.value = `${localizeAdminLabel(props.appLocale, props.config.title)}: ${adminText(props.appLocale, "delete")}.`;
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
  formSnapshot.value = JSON.stringify(formValues.value);
  error.value = null;
  notice.value = null;
}

function getErrorMessage(apiError: unknown): string {
  if (apiError instanceof ApiRequestError) {
    if (apiError.status === 401) {
      return props.appLocale === "ru" ? "Требуется аутентификация." : "Authentication is required.";
    }

    if (apiError.status === 403) {
      return props.appLocale === "ru" ? "Требуется доступ администратора." : "Admin access is required.";
    }

    if (apiError.status === 409) {
      return props.appLocale === "ru" ? "Запись конфликтует с существующими данными или зависимостями." : "Record conflicts with existing data or dependencies.";
    }

    return props.appLocale === "ru" ? "Запрос завершился ошибкой." : "Request failed.";
  }

  return props.appLocale === "ru" ? "Запрос завершился ошибкой." : "Request failed.";
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

function recordMatches(record: AdminRecord, query: string): boolean {
  return Object.values(record).some((value) => String(value ?? "").toLowerCase().includes(query));
}

function requestCancel(): void {
  if (isDirty.value) {
    pendingDiscard.value = true;
    return;
  }

  resetForm();
}

function resetForm(): void {
  selectedRecord.value = null;
  formValues.value = createEmptyFormValues(props.config);
  formSnapshot.value = JSON.stringify(formValues.value);
  pendingDiscard.value = false;
  error.value = null;
}

async function submitForm(): Promise<void> {
  const validationError = validateForm(props.config, formValues.value, props.appLocale);

  if (validationError) {
    error.value = validationError;
    return;
  }
  if (props.config.id === "region-links" && records.value.some((record) =>
    record.id !== selectedRecord.value?.id &&
    ((record.region_a === formValues.value.region_a && record.region_b === formValues.value.region_b) ||
      (record.region_a === formValues.value.region_b && record.region_b === formValues.value.region_a)))) {
    error.value = props.appLocale === "ru"
      ? "Симметричная связь между этими регионами уже существует."
      : "A symmetric link between these regions already exists.";
    return;
  }

  isSubmitting.value = true;
  error.value = null;
  notice.value = null;

  try {
    const payload = createPayload(props.config, formValues.value);

    if (selectedRecord.value?.id) {
      await adminApi.updateRecord(props.config, selectedRecord.value.id, payload);
      notice.value = `${localizeAdminLabel(props.appLocale, props.config.title)}: ${adminText(props.appLocale, "save")}.`;
    } else {
      await adminApi.createRecord(props.config, payload);
      notice.value = `${localizeAdminLabel(props.appLocale, props.config.title)}: ${adminText(props.appLocale, "create")}.`;
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
          :label="adminText(appLocale, 'openapi')"
          variant="success-soft"
        />
        <h1 class="mt-4 text-h2 text-text-primary">
          {{ localizeAdminLabel(appLocale, config.title) }}
        </h1>
        <p class="mt-2 max-w-3xl text-body text-text-muted">
          {{ localizeAdminLabel(appLocale, config.description) }}
        </p>
      </div>
      <AirButton
        :label="adminText(appLocale, 'refresh')"
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

      <div v-if="pendingDelete" class="rounded-md border border-warning bg-warning-bg p-3 text-slate-950">
        <strong>{{ adminText(appLocale, "deleteTitle") }}</strong>
        <p class="mt-1 text-body">
          {{ adminText(appLocale, "deleteDescription") }}
        </p>
        <div class="mt-3 flex gap-2">
          <AirButton
            :label="adminText(appLocale, 'confirmDelete')"
            size="sm"
            variant="danger"
            @click="deleteRecord(pendingDelete)"
          />
          <AirButton
            :label="adminText(appLocale, 'cancel')"
            size="sm"
            variant="primary-soft"
            @click="pendingDelete = null"
          />
        </div>
      </div>

      <div v-if="pendingDiscard" class="rounded-md border border-warning bg-warning-bg p-3 text-slate-950">
        <strong>{{ adminText(appLocale, "confirmDiscard") }}</strong>
        <p class="mt-1 text-body">
          {{ adminText(appLocale, "discardDescription") }}
        </p>
        <div class="mt-3 flex gap-2">
          <AirButton
            :label="adminText(appLocale, 'confirmDiscard')"
            size="sm"
            variant="warning"
            @click="resetForm"
          />
          <AirButton
            :label="adminText(appLocale, 'cancel')"
            size="sm"
            variant="primary-soft"
            @click="pendingDiscard = false"
          />
        </div>
      </div>

      <AdminEntityForm
        v-model:values="formValues"
        :config="config"
        :app-locale="appLocale"
        :error="error"
        :is-editing="isEditing"
        :is-submitting="isSubmitting"
        :reference-options="referenceOptions"
        @cancel="requestCancel"
        @submit="submitForm"
      />

      <div>
        <div class="mb-3 flex items-center justify-between gap-4">
          <h2 class="text-h4 text-text-primary">
            {{ adminText(appLocale, "records") }}
          </h2>
          <span class="text-caption text-text-muted">
            {{ isLoading ? adminText(appLocale, "loading") : `${records.length} ${adminText(appLocale, "total")}` }}
          </span>
        </div>
        <input
          v-model="search"
          class="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-body outline-none focus:border-primary"
          :placeholder="adminText(appLocale, 'search')"
          type="search"
        />

        <AdminRecordTable
          :columns="config.columns"
          :app-locale="appLocale"
          :records="filteredRecords"
          @delete="deleteRecord"
          @edit="editRecord"
        />
      </div>
    </div>
  </section>
</template>
