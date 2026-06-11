<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { computed, onMounted, ref } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { FleetOwnedAircraftCard, FuelStorageSnapshot } from "../types";

import { getFuelStorage, purchaseFuelTonnes } from "../api";
import { formatMoneyValue, formatNumberValue } from "../formatters";
import FuelStorageChart from "./FuelStorageChart.vue";

const props = defineProps<{
  appLocale: Locale;
  currentPrice: null | number;
  ownedAircraft: FleetOwnedAircraftCard[];
  t: (key: FleetMessageKey | string) => string;
}>();

const storage = ref<FuelStorageSnapshot | null>(null);
const purchaseTonnes = ref(100);
const isBuying = ref(false);
const purchaseMessage = ref("");
const purchaseFailed = ref(false);

const storagePercent = computed(() => {
  if (!storage.value || storage.value.capacity_tonnes <= 0) { return 0; }
  return Math.round((storage.value.stored_tonnes / storage.value.capacity_tonnes) * 1000) / 10;
});

const purchaseCost = computed(() => {
  const price = storage.value?.current_price_per_tonne ?? props.currentPrice ?? 0;
  return Math.round(Math.max(0, purchaseTonnes.value) * price);
});

// Rough endurance estimate: tonnes in the tank vs the whole fleet burning ~8h/day.
const storageEnduranceDays = computed(() => {
  if (!storage.value) { return null; }
  const fleetBurnPerHour = props.ownedAircraft.reduce((sum, ac) => sum + (ac.type?.fuel_consumption_per_hour ?? 0), 0) / 1000;
  if (fleetBurnPerHour <= 0) { return null; }
  return Math.floor(storage.value.stored_tonnes / (fleetBurnPerHour * 8));
});

onMounted(() => {
  void refresh();
});

async function buyFuel(): Promise<void> {
  if (purchaseTonnes.value <= 0) { return; }
  isBuying.value = true;
  purchaseMessage.value = "";
  purchaseFailed.value = false;
  try {
    const result = await purchaseFuelTonnes(purchaseTonnes.value);
    storage.value = result.storage;
    purchaseMessage.value = `${props.t("fuel.storage.purchased")}: ${formatNumberValue(props.appLocale, purchaseTonnes.value)} t · ${formatMoneyValue(props.appLocale, result.cost)}`;
  } catch (err) {
    purchaseFailed.value = true;
    purchaseMessage.value = err instanceof Error ? err.message : props.t("fuel.error");
  } finally {
    isBuying.value = false;
  }
}

async function refresh(): Promise<void> {
  try {
    storage.value = (await getFuelStorage()).storage;
  } catch {
    storage.value = null;
  }
}
</script>

<template>
  <section class="rounded-lg border border-border bg-surface p-4 shadow-sm">
    <div class="mb-4">
      <h2 class="text-subtitle font-bold text-text-primary">
        {{ props.t("fuel.storage.title") }}
      </h2>
      <p class="text-caption text-text-muted mt-0.5">
        {{ props.t("fuel.storage.subtitle") }}
      </p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <AirMetricCard
        :label="props.t('fuel.storage.stored')"
        tone="success"
        :value="`${formatNumberValue(props.appLocale, storage?.stored_tonnes ?? 0)} t`"
      />
      <AirMetricCard
        :label="props.t('fuel.storage.capacity')"
        :value="`${storagePercent}% / ${formatNumberValue(props.appLocale, storage?.capacity_tonnes ?? 0)} t`"
      />
      <AirMetricCard
        :label="props.t('fuel.storage.avgPrice')"
        :value="storage?.average_purchase_price != null ? formatMoneyValue(props.appLocale, storage.average_purchase_price) : '—'"
      />
      <AirMetricCard
        :label="props.t('fuel.storage.endurance')"
        :value="storageEnduranceDays != null ? `≈ ${storageEnduranceDays} ${props.t('unit.day')}` : '—'"
      />
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="rounded-lg border border-border bg-background p-4 lg:col-span-2">
        <FuelStorageChart
          v-if="storage?.history?.length"
          :history="storage.history"
          :locale="props.appLocale"
        />
        <p
          v-else
          class="py-16 text-center text-body text-text-muted"
        >
          {{ props.t("fuel.storage.empty") }}
        </p>
      </div>

      <div class="rounded-lg border border-border bg-background p-4">
        <h3 class="text-subtitle font-bold text-text-primary">
          {{ props.t("fuel.storage.buyTitle") }}
        </h3>
        <p class="mt-1 text-caption text-text-muted">
          {{ props.t("fuel.storage.buyHint") }}
        </p>
        <label class="mt-3 block text-caption font-medium text-text-muted">
          {{ props.t("fuel.storage.amount") }}
          <input
            v-model.number="purchaseTonnes"
            class="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-body text-text-primary"
            min="1"
            step="50"
            type="number"
          />
        </label>
        <p class="mt-2 flex items-center justify-between text-caption text-text-muted">
          <span>{{ props.t("fuel.storage.cost") }}</span>
          <strong class="text-body text-text-primary">{{ formatMoneyValue(props.appLocale, purchaseCost) }}</strong>
        </p>
        <AirButton
          class="mt-3 w-full"
          :disabled="isBuying || purchaseTonnes <= 0"
          :label="isBuying ? '...' : props.t('fuel.storage.buy')"
          @click="buyFuel"
        />
        <p
          v-if="purchaseMessage"
          class="mt-2 text-caption"
          :class="purchaseFailed ? 'text-error' : 'text-success'"
        >
          {{ purchaseMessage }}
        </p>
      </div>
    </div>
  </section>
</template>
