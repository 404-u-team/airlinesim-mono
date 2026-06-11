<script setup lang="ts">
import { AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { type Locale } from "@airlinesim/i18n";
import { computed, onMounted, ref } from "vue";

import { type AdminAirline, type AdminAirlineDetail, creditAirline, getAirlineDetail, listAirlines } from "../api/airlinesApi";
import { adminText, type AdminTextKey } from "../i18n";

const props = defineProps<{ appLocale: Locale }>();

const t = computed(() => (key: AdminTextKey): string => adminText(props.appLocale, key));

const airlines = ref<AdminAirline[]>([]);
const detail = ref<AdminAirlineDetail | null>(null);
const selectedId = ref("");
const amount = ref("");
const note = ref("");
const error = ref("");
const isLoading = ref(false);
const isCrediting = ref(false);

onMounted(() => {
  void loadList();
});

async function applyCredit(): Promise<void> {
  const parsed = Number(amount.value);
  if (!Number.isFinite(parsed) || parsed === 0 || !selectedId.value) {
    return;
  }

  isCrediting.value = true;
  error.value = "";

  const adjustment = Math.round(parsed);
  const adjustmentNote = note.value || undefined;
  amount.value = "";
  note.value = "";

  try {
    await creditAirline(selectedId.value, { amount: adjustment, note: adjustmentNote });
    await selectAirline(selectedId.value);
  } catch (creditError) {
    error.value = creditError instanceof Error ? creditError.message : "Failed to apply adjustment.";
  } finally {
    isCrediting.value = false;
  }
}

function backendName(value: AdminAirlineDetail | null): string {
  const name = value?.airline?.name ?? value?.airline?.intl_name;

  return typeof name === "string" && name ? name : value?.registry?.name ?? selectedId.value;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat(props.appLocale, { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(value);
}

async function loadList(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const response = await listAirlines();
    airlines.value = response.airlines;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : "Failed to load airlines.";
  } finally {
    isLoading.value = false;
  }
}

async function selectAirline(airlineId: string): Promise<void> {
  selectedId.value = airlineId;
  error.value = "";

  try {
    detail.value = await getAirlineDetail(airlineId);
  } catch (detailError) {
    error.value = detailError instanceof Error ? detailError.message : "Failed to load airline.";
  }
}
</script>

<template>
  <div class="h-full space-y-6 overflow-y-auto bg-background p-4 sm:p-6">
    <header class="flex items-center justify-between border-b border-border pb-4">
      <div>
        <h1 class="text-h2 text-text-primary">
          {{ t("airlineTitle") }}
        </h1>
        <p class="mt-1 text-caption text-text-muted">
          {{ t("airlineDescription") }}
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="t('refresh')"
        size="sm"
        @click="loadList"
      />
    </header>

    <p
      v-if="error"
      class="rounded-lg border border-error bg-error-bg p-3 text-body text-error"
    >
      {{ error }}
    </p>

    <div class="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <section class="rounded-lg border border-border bg-surface p-3">
        <p
          v-if="airlines.length === 0"
          class="p-3 text-caption text-text-muted"
        >
          {{ t("airlineEmpty") }}
        </p>
        <ul
          v-else
          class="space-y-1"
        >
          <li
            v-for="airline in airlines"
            :key="airline.id"
          >
            <button
              class="w-full rounded-md px-3 py-2 text-left transition hover:bg-surface-subtle"
              :class="selectedId === airline.id ? 'bg-surface-subtle font-medium text-primary' : 'text-text-primary'"
              type="button"
              @click="selectAirline(airline.id)"
            >
              <span class="block truncate text-body">{{ airline.name }}</span>
              <span class="block truncate text-caption text-text-muted">{{ airline.id }}</span>
            </button>
          </li>
        </ul>
      </section>

      <section
        v-if="detail"
        class="space-y-4"
      >
        <h2 class="text-subtitle text-text-primary">
          {{ backendName(detail) }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <AirMetricCard
            :label="t('airlineBalance')"
            :value="formatMoney(detail.operations_delta)"
          />
          <AirMetricCard
            :label="t('airlineLastSeen')"
            :value="detail.registry ? new Date(detail.registry.last_seen_at).toLocaleString() : '—'"
          />
        </div>

        <div class="rounded-lg border border-border bg-surface p-4">
          <h3 class="text-subtitle text-text-primary">
            {{ t("airlineCreditAction") }}
          </h3>
          <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label class="grid gap-1 text-caption text-text-muted">
              {{ t("airlineCreditAmount") }}
              <input
                v-model="amount"
                class="rounded-md border border-border bg-background px-2 py-1 text-body text-text-primary"
                inputmode="numeric"
                type="number"
              />
            </label>
            <label class="grid gap-1 text-caption text-text-muted">
              {{ t("airlineCreditNote") }}
              <input
                v-model="note"
                class="rounded-md border border-border bg-background px-2 py-1 text-body text-text-primary"
                type="text"
              />
            </label>
            <AirButton
              :disabled="isCrediting"
              :label="isCrediting ? '...' : t('airlineCreditAction')"
              @click="applyCredit"
            />
          </div>
        </div>
      </section>

      <section
        v-else
        class="rounded-lg border border-border bg-surface p-6 text-body text-text-muted"
      >
        {{ t("airlineSelect") }}
      </section>
    </div>
  </div>
</template>
