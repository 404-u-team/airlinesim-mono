<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirCombobox, type AirComboboxOption } from "@airlinesim/air-ui";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type { AirportSearchOption, HubPreviewResponse } from "../types";

import { addHub, getHubPreview, searchAirports } from "../api";

const props = defineProps<{
  appLocale: Locale;
  isMutating: boolean;
  t: (key: NetworkMessageKey) => string;
}>();

const emit = defineEmits<{
  (e: "established", fee: number): void;
  (e: "error", msg: string): void;
}>();

const selectedAirportId = ref("");
const airportOptions = ref<AirComboboxOption[]>([]);
const selectedAirportDetail = ref<HubPreviewResponse | null>(null);
const isPreviewLoading = ref(false);
const previewError = ref("");

let searchTimer: null | ReturnType<typeof setTimeout> = null;

onMounted(() => {
  void runSearch("");
});

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

function formatMoney(value: number): string {
  return new Intl.NumberFormat(props.appLocale, { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function formatNumber(value: number | undefined): string {
  if (value === undefined) {
    return "—";
  }
  return new Intl.NumberFormat(props.appLocale, { maximumFractionDigits: 0 }).format(value);
}

async function onAdd(): Promise<void> {
  const airportId = selectedAirportId.value;
  if (!airportId) {
    return;
  }
  
  selectedAirportId.value = "";
  selectedAirportDetail.value = null;
  
  try {
    const response = await addHub(airportId);
    emit("established", response.fee);
  } catch (addError) {
    const msg = addError instanceof Error ? addError.message : props.t("error.load");
    emit("error", msg);
  }
}

function onSearch(query: string): void {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => void runSearch(query), 300);
}

async function runSearch(query: string): Promise<void> {
  try {
    const airports = await searchAirports(query);
    airportOptions.value = airports.map((airport: AirportSearchOption) => ({
      label: `${airport.iata_code ?? airport.icao_code ?? "---"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`,
      value: airport.id,
    }));
  } catch {
    emit("error", props.t("hubs.searchError"));
  }
}

watch(selectedAirportId, async (newId) => {
  if (!newId) {
    selectedAirportDetail.value = null;
    previewError.value = "";
    return;
  }
  
  isPreviewLoading.value = true;
  previewError.value = "";
  try {
    selectedAirportDetail.value = await getHubPreview(newId);
  } catch (err) {
    previewError.value = err instanceof Error ? err.message : props.t("hubs.searchError");
    selectedAirportDetail.value = null;
  } finally {
    isPreviewLoading.value = false;
  }
});
</script>

<template>
  <div class="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-4">
    <div>
      <h2 class="text-h3 font-bold tracking-tight text-text">
        {{ props.t("hubs.preview.title") }}
      </h2>
      <p class="text-caption text-text-muted mt-1">
        {{ props.t("hubs.addHint") }}
      </p>
    </div>

    <!-- Combobox search -->
    <div class="flex flex-col gap-1">
      <AirCombobox
        :empty-text="props.t('hubs.searchPlaceholder')"
        :label="props.t('hubs.add')"
        :model-value="selectedAirportId"
        :options="airportOptions"
        :placeholder="props.t('hubs.searchPlaceholder')"
        @search="onSearch"
        @update:model-value="selectedAirportId = $event"
      />
    </div>

    <!-- State 1: Nothing selected -->
    <div
      v-if="!selectedAirportId && !isPreviewLoading"
      class="rounded-lg border border-dashed border-border p-6 text-center text-text-muted bg-surface-subtle"
    >
      <p class="text-caption leading-relaxed">
        {{ props.t("hubs.preview.selectHint") }}
      </p>
    </div>

    <!-- State 2: Preview Loading -->
    <div v-else-if="isPreviewLoading" class="flex flex-col items-center justify-center py-12 text-text-muted">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <span class="text-caption mt-3">{{ props.t("hubs.preview.loading") }}</span>
    </div>

    <!-- State 3: Preview Load Error -->
    <div v-else-if="previewError" class="rounded-lg bg-danger-soft p-4 text-error text-caption">
      {{ previewError }}
    </div>

    <!-- State 4: Preview Details Display -->
    <div v-else-if="selectedAirportDetail" class="flex flex-col gap-5">
      <!-- Airport Header in Preview -->
      <div class="rounded-lg bg-surface-subtle p-3.5 border border-border">
        <h3 class="font-bold text-body text-text flex items-center gap-1.5">
          <span class="text-primary font-extrabold">{{ selectedAirportDetail.airport.iata_code ?? selectedAirportDetail.airport.icao_code ?? '---' }}</span>
          <span>·</span>
          <span class="line-clamp-1 font-medium">{{ selectedAirportDetail.airport.intl_name ?? selectedAirportDetail.airport.local_name ?? 'Airport' }}</span>
        </h3>
        <p class="text-caption text-text-muted mt-0.5">
          {{ selectedAirportDetail.airport.municipality }}{{ selectedAirportDetail.airport.country_id ? `, ${selectedAirportDetail.airport.country_id}` : '' }}
        </p>
      </div>

      <!-- Specifications Section -->
      <div class="flex flex-col gap-3">
        <h4 class="text-caption font-bold text-text uppercase tracking-wider text-[10px]">
          {{ props.t("hubs.preview.airportSpec") }}
        </h4>
        <div class="rounded-lg border border-border divide-y divide-border bg-surface-subtle/50 text-caption">
          <!-- Runway -->
          <div class="flex justify-between p-2.5">
            <span class="text-text-muted">{{ props.t("hubs.preview.runway") }}</span>
            <span class="font-medium text-text">
              {{ formatNumber(selectedAirportDetail.airport.max_runway_length_m) }} {{ props.t('hubs.preview.m') }}
            </span>
          </div>
          <!-- Slot Limit -->
          <div class="flex justify-between p-2.5">
            <span class="text-text-muted">{{ props.t("hubs.preview.slots") }}</span>
            <span class="font-medium text-text">
              {{ formatNumber(selectedAirportDetail.airport.max_runway_uses_per_day) }} {{ props.t('hubs.preview.slotsVal') }}
            </span>
          </div>
          <!-- Night Operations -->
          <div class="flex justify-between items-center p-2.5">
            <span class="text-text-muted">{{ props.t("hubs.preview.nightOps") }}</span>
            <AirBadge
              :label="selectedAirportDetail.airport.works_at_night ? props.t('hubs.preview.nightOps.allowed') : props.t('hubs.preview.nightOps.prohibited')"
              :variant="selectedAirportDetail.airport.works_at_night ? 'success-soft' : 'warning-soft'"
              size="sm"
            />
          </div>
        </div>
      </div>

      <!-- Fee Breakdown Section -->
      <div class="flex flex-col gap-3">
        <h4 class="text-caption font-bold text-text uppercase tracking-wider text-[10px]">
          {{ props.t("hubs.preview.feeBreakdown") }}
        </h4>
        <div class="rounded-lg border border-border divide-y divide-border bg-surface-subtle/50 text-caption">
          <!-- Base Fee -->
          <div class="flex justify-between p-2.5">
            <span class="text-text-muted">{{ props.t("hubs.preview.baseFee") }}</span>
            <span class="text-text">{{ formatMoney(selectedAirportDetail.fee_details.base_fee) }}</span>
          </div>
          <!-- Airport Weight -->
          <div class="flex justify-between p-2.5">
            <span class="text-text-muted flex flex-col">
              <span>{{ props.t("hubs.preview.airportWeight") }}</span>
              <span class="text-[10px] text-text-muted/80 mt-0.5">Based on runway, slots & fees</span>
            </span>
            <span class="text-text">+{{ formatMoney(selectedAirportDetail.fee_details.airport_weight) }}</span>
          </div>
          <!-- Region Weight -->
          <div class="flex justify-between p-2.5">
            <span class="text-text-muted flex flex-col">
              <span>{{ props.t("hubs.preview.regionWeight") }}</span>
              <span class="text-[10px] text-text-muted/80 mt-0.5">Based on population, GDP & score</span>
            </span>
            <span class="text-text">+{{ formatMoney(selectedAirportDetail.fee_details.region_weight) }}</span>
          </div>

          <!-- Min/Max caps notes (if applicable) -->
          <div 
            v-if="selectedAirportDetail.fee_details.raw_total < selectedAirportDetail.fee_details.min_fee_cap"
            class="p-2.5 text-[10px] text-primary-soft italic bg-primary-soft/5"
          >
            * Adjusted to minimum cap limit of {{ formatMoney(selectedAirportDetail.fee_details.min_fee_cap) }}
          </div>
          <div 
            v-else-if="selectedAirportDetail.fee_details.raw_total > selectedAirportDetail.fee_details.max_fee_cap"
            class="p-2.5 text-[10px] text-warning-soft italic bg-warning-soft/5"
          >
            * Adjusted to maximum cap limit of {{ formatMoney(selectedAirportDetail.fee_details.max_fee_cap) }}
          </div>

          <!-- Final Total Fee -->
          <div class="flex justify-between p-3 bg-surface-subtle font-bold text-body border-t border-border">
            <span class="text-text">{{ props.t("hubs.preview.totalFee") }}</span>
            <span class="text-primary font-extrabold">{{ formatMoney(selectedAirportDetail.fee_details.final_fee) }}</span>
          </div>
        </div>
      </div>

      <!-- Balance Validation Section -->
      <div class="flex flex-col gap-3 border-t border-border pt-4">
        <div class="flex justify-between text-caption text-text-muted">
          <span>{{ props.t("hubs.preview.balance") }}</span>
          <span class="font-medium text-text">{{ formatMoney(selectedAirportDetail.balance.available) }}</span>
        </div>
        
        <div class="flex justify-between text-caption font-semibold">
          <span>{{ props.t("hubs.preview.balanceAfter") }}</span>
          <span :class="selectedAirportDetail.balance.remaining < 0 ? 'text-error font-bold' : 'text-success'">
            {{ formatMoney(selectedAirportDetail.balance.remaining) }}
          </span>
        </div>

        <!-- Insufficient Funds Warning -->
        <div 
          v-if="!selectedAirportDetail.balance.can_afford" 
          class="rounded-lg bg-danger-soft p-3 text-error text-[11px] font-medium mt-1 border border-error/20 flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>{{ props.t("hubs.preview.insufficientFunds") }}</span>
        </div>

        <!-- Action Button -->
        <AirButton
          :disabled="!selectedAirportDetail.balance.can_afford || props.isMutating"
          :label="`${props.t('hubs.preview.establish')} · ${formatMoney(selectedAirportDetail.fee_details.final_fee)}`"
          variant="primary"
          class="w-full mt-2"
          @click="onAdd"
        />
      </div>
    </div>
  </div>
</template>
