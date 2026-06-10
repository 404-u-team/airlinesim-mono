<script setup lang="ts">
import { AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, onMounted, ref } from "vue";

import type { FuelPriceSnapshot } from "../../fuel/types";

import { getFuelHistory, getFuelPrice } from "../api/fuelApi";
import { type AdminFuelMessageKey, adminFuelMessages } from "../i18n";

const props = defineProps<{ appLocale: Locale }>();

const t = computed(() => (key: AdminFuelMessageKey): string =>
  translate(adminFuelMessages, props.appLocale, key)
);

const currentPrice = ref<FuelPriceSnapshot | null>(null);
const history = ref<FuelPriceSnapshot[]>([]);
const isLoading = ref(false);
const error = ref("");

async function loadData(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    const [priceRes, historyRes] = await Promise.all([
      getFuelPrice(),
      getFuelHistory()
    ]);
    currentPrice.value = priceRes;
    history.value = historyRes.history || [];
  } catch (err) {
    error.value = "Failed to load fuel monitoring data.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadData();
});

function formatTime(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    return date.toLocaleString(props.appLocale === "ru" ? "ru-RU" : "en-US", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      second: "2-digit",
      year: "numeric"
    });
  } catch {
    return isoStr;
  }
}
</script>

<template>
  <div class="h-full overflow-y-auto p-4 sm:p-6 space-y-6 bg-background">
    <!-- Header -->
    <header class="flex items-center justify-between border-b border-border pb-4">
      <div>
        <h1 class="text-h2 text-text-primary">
          {{ t("title") }}
        </h1>
        <p class="text-caption text-text-muted mt-1">
          {{ t("historyDescription") }}
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        label="Refresh"
        size="sm"
        @click="loadData"
      />
    </header>

    <!-- Error Banner -->
    <p v-if="error" class="rounded-lg border border-error bg-error-bg p-3 text-error text-body">
      {{ error }}
    </p>

    <!-- Headline Cards -->
    <div v-if="currentPrice" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AirMetricCard
        :label="t('currentPrice')"
        :value="`$${currentPrice.price.toLocaleString()} / t`"
      />
      <AirMetricCard
        label="Unit Price (USD)"
        :value="`$${currentPrice.unit_price.toLocaleString()}`"
      />
      <AirMetricCard
        :label="t('source')"
        :value="currentPrice.source"
      />
      <AirMetricCard
        :label="t('updatedAt')"
        :value="formatTime(currentPrice.updated_at || currentPrice.recorded_at)"
      />
    </div>

    <!-- History Table -->
    <section class="rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h2 class="text-subtitle text-text-primary mb-4">
        {{ t("historyTitle") }}
      </h2>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-left text-caption">
          <thead>
            <tr class="border-b border-border text-text-muted bg-surface-subtle">
              <th class="px-4 py-3 font-semibold">
                {{ t("recordedAt") }}
              </th>
              <th class="px-4 py-3 font-semibold">
                {{ t("price") }}
              </th>
              <th class="px-4 py-3 font-semibold">
                Unit Price
              </th>
              <th class="px-4 py-3 font-semibold">
                {{ t("source") }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border text-text-primary">
            <tr v-for="item in history" :key="item.recorded_at" class="hover:bg-surface-subtle/50 transition">
              <td class="px-4 py-3 whitespace-nowrap">
                {{ formatTime(item.recorded_at) }}
              </td>
              <td class="px-4 py-3 font-medium font-mono">
                ${{ item.price.toLocaleString() }}
              </td>
              <td class="px-4 py-3 font-medium font-mono">
                ${{ item.unit_price.toLocaleString() }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-soft text-text-muted"
                >
                  {{ item.source }}
                </span>
              </td>
            </tr>
            <tr v-if="history.length === 0">
              <td colspan="4" class="px-4 py-8 text-center text-text-muted">
                No history records found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
