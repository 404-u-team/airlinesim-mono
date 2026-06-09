<script setup lang="ts">
import { AirAircraftThumb, AirBadge, AirButton, AirMetricCard, AirSelect, AirStatePanel, AirTextField } from "@airlinesim/air-ui";
import { computed } from "vue";

import type {
  FleetMarketAircraftType,
  FleetMarketResponse,
  FleetPurchasePreviewResponse,
  FleetReason,
} from "../types";

type StatusVariant = "danger-soft" | "primary-soft" | "success-soft" | "warning-soft";

const props = defineProps<{
  canConfirmPurchase: boolean;
  error: string;
  filters: { baseAirportId: string; maxPrice: string; minCapacity: string; minRange: string; q: string; sort: string };
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  hubOptions: Array<{ label: string; value: string }>;
  isConfirmingRisk: boolean;
  isLoading: boolean;
  isPreviewLoading: boolean;
  isPurchasing: boolean;
  market: FleetMarketResponse | null;
  message: string;
  preview: FleetPurchasePreviewResponse | null;
  purchaseReasons: FleetReason[];
  reasonLabel: (reason: FleetReason) => string;
  requiresRiskAcknowledge: boolean;
  selectedType: FleetMarketAircraftType | null;
  selectedTypeId: string;
  sortOptions: Array<{ label: string; value: string }>;
  statusLabel: (status: FleetMarketAircraftType["compatibility"]["status"]) => string;
  statusVariant: (status: FleetMarketAircraftType["compatibility"]["status"]) => StatusVariant;
  t: (key: string) => string;
  tailNumber: string;
}>();

const emit = defineEmits<{
  "confirm-purchase": [];
  navigate: [path: string];
  refresh: [];
  "select-type": [type: FleetMarketAircraftType];
  "update-confirming-risk": [value: boolean];
  "update-filter": [key: "baseAirportId" | "maxPrice" | "minCapacity" | "minRange" | "q" | "sort", value: string];
  "update-tail-number": [value: string];
}>();

const baseAirportModel = computed({
  get: () => props.filters.baseAirportId,
  set: (value: string) => emit("update-filter", "baseAirportId", value),
});
const confirmingRiskModel = computed({
  get: () => props.isConfirmingRisk,
  set: (value: boolean) => emit("update-confirming-risk", value),
});
const maxPriceModel = computed({
  get: () => props.filters.maxPrice,
  set: (value: string) => emit("update-filter", "maxPrice", value),
});
const minCapacityModel = computed({
  get: () => props.filters.minCapacity,
  set: (value: string) => emit("update-filter", "minCapacity", value),
});
const minRangeModel = computed({
  get: () => props.filters.minRange,
  set: (value: string) => emit("update-filter", "minRange", value),
});
const queryModel = computed({
  get: () => props.filters.q,
  set: (value: string) => emit("update-filter", "q", value),
});
const sortModel = computed({
  get: () => props.filters.sort,
  set: (value: string) => emit("update-filter", "sort", value),
});
const tailNumberModel = computed({
  get: () => props.tailNumber,
  set: (value: string) => emit("update-tail-number", value),
});
</script>

<template>
  <div class="flex min-h-full flex-col gap-4">
    <header class="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <h1 class="text-h2">
          {{ t("fleet.order.title") }}
        </h1>
        <p class="mt-1 max-w-3xl text-body text-text-muted">
          {{ t("fleet.order.subtitle") }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AirButton
          :label="t('fleet.action.overview')"
          size="sm"
          variant="primary-soft"
          @click="emit('navigate', '/fleet/overview')"
        />
        <AirButton
          :disabled="isLoading"
          :label="t('action.refresh')"
          size="sm"
          variant="primary-soft"
          @click="emit('refresh')"
        />
      </div>
    </header>

    <AirStatePanel
      v-if="error"
      :body="error"
      :title="t('error.load')"
      tone="danger"
    />
    <AirStatePanel
      v-else-if="message"
      :title="message"
      tone="success"
    />

    <section class="grid gap-3 rounded-lg border border-border bg-surface p-4 lg:grid-cols-[minmax(14rem,1fr)_repeat(3,minmax(9rem,0.45fr))_13rem] lg:items-end">
      <AirTextField
        v-model="queryModel"
        :label="t('filter.search')"
        :placeholder="t('filter.search.placeholder')"
        type="search"
      />
      <AirTextField
        v-model="minRangeModel"
        :label="t('filter.minRange')"
        type="number"
      />
      <AirTextField
        v-model="minCapacityModel"
        :label="t('filter.minCapacity')"
        type="number"
      />
      <AirTextField
        v-model="maxPriceModel"
        :label="t('filter.maxPrice')"
        type="number"
      />
      <AirSelect
        v-model="sortModel"
        :label="t('filter.sort')"
        :options="sortOptions"
      />
    </section>

    <div
      v-if="market"
      class="fleet-order-grid"
    >
      <section class="min-w-0 overflow-hidden rounded-lg border border-border bg-surface">
        <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 class="text-subtitle">
              {{ t("fleet.order.catalog") }}
            </h2>
            <p class="mt-1 text-caption text-text-muted">
              {{ t("fleet.order.catalog.subtitle") }}
            </p>
          </div>
          <AirBadge
            :label="formatNumber(market.summary.visibleTypes)"
            variant="primary-soft"
          />
        </div>

        <div class="grid max-h-[44rem] gap-3 overflow-y-auto p-3 lg:grid-cols-2 2xl:grid-cols-3">
          <button
            v-for="type in market.aircraftTypes"
            :key="type.id"
            class="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-left transition hover:border-primary"
            :class="selectedTypeId === type.id ? 'outline outline-2 outline-primary' : ''"
            type="button"
            @click="emit('select-type', type)"
          >
            <span class="grid h-36 place-items-center overflow-hidden border-b border-border bg-surface-subtle text-h3 text-text-muted">
              <img
                v-if="type.image_url"
                :alt="type.model_name || 'Aircraft type'"
                class="size-full object-cover"
                loading="lazy"
                :src="type.image_url"
              />
              <template v-else>{{ type.icao_code || "----" }}</template>
            </span>
            <span class="flex min-h-52 flex-col gap-3 p-3">
              <span class="min-w-0">
                <span class="flex items-start justify-between gap-2">
                  <span class="min-w-0">
                    <span class="block truncate text-subtitle">{{ type.model_name || "Aircraft type" }}</span>
                    <span class="mt-0.5 block text-caption text-text-muted">{{ type.icao_code || type.iata_code || "----" }}</span>
                  </span>
                  <AirBadge
                    :label="statusLabel(type.compatibility.status)"
                    size="sm"
                    :variant="statusVariant(type.compatibility.status)"
                  />
                </span>
              </span>

              <span class="grid grid-cols-2 gap-2 text-caption text-text-muted">
                <span>{{ formatNumber(type.max_planned_seat_capacity) }} {{ t("metric.seats") }}</span>
                <span>{{ formatNumber(type.max_range_km) }} {{ t("unit.km") }}</span>
                <span>{{ formatNumber(type.min_runway_length_m) }} {{ t("unit.m") }}</span>
                <span>{{ formatMoney(type.price_per_unit) }}</span>
              </span>

              <span class="mt-auto text-caption text-text-muted">
                {{ type.compatibility.warnings[0] ? reasonLabel(type.compatibility.warnings[0]) : t("fleet.order.compatible") }}
              </span>
            </span>
          </button>

          <p
            v-if="market.aircraftTypes.length === 0"
            class="p-5 text-text-muted"
          >
            {{ t("market.empty") }}
          </p>
        </div>
      </section>

      <aside class="grid min-w-0 content-start gap-4">
        <section class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ t("purchase.preview") }}
          </h2>
          <div class="mt-2 flex items-center gap-3">
            <AirAircraftThumb
              v-if="selectedType"
              :alt="selectedType.model_name"
              :fallback="selectedType.icao_code"
              :image-url="selectedType.image_url"
              size="sm"
            />
            <p class="min-w-0 truncate text-caption text-text-muted">
              {{ selectedType?.model_name ?? t("purchase.select") }}
            </p>
          </div>

          <div
            v-if="hubOptions.length"
            class="mt-4 flex flex-col gap-1"
          >
            <span class="text-caption text-text-muted">{{ t("fleet.order.deliveryHub") }}</span>
            <AirSelect
              v-model="baseAirportModel"
              class="w-full"
              :label="t('fleet.order.deliveryHub')"
              :options="hubOptions"
            />
            <span class="text-caption text-text-muted">{{ t("fleet.order.deliveryHubHint") }}</span>
          </div>

          <AirTextField
            v-model="tailNumberModel"
            class="mt-4"
            :hint="preview?.tailNumber.suggestedPrefix ? `${t('tail.hint')} ${preview.tailNumber.suggestedPrefix}` : t('tail.hint')"
            :label="t('aircraft.tail')"
            :placeholder="t('tail.placeholder')"
          />

          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <AirMetricCard
              :label="t('metric.price')"
              :value="formatMoney(preview?.aircraftPrice)"
            />
            <AirMetricCard
              :label="t('metric.remaining')"
              :tone="preview?.remainingBalance && preview.remainingBalance > 0 ? 'success' : 'danger'"
              :value="formatMoney(preview?.remainingBalance)"
            />
            <AirMetricCard
              :label="t('metric.reserve')"
              :tone="preview?.warnings.some((warning) => warning.code === 'FLEET_RESERVE_RISK') ? 'warning' : 'neutral'"
              :value="formatMoney(preview?.recommendedReserve)"
            />
            <AirMetricCard
              :label="t('metric.maintenance')"
              :value="`${formatMoney(preview?.estimatedDailyMaintenanceReserve)}/${t('unit.day')}`"
            />
          </div>

          <div
            v-if="purchaseReasons.length"
            class="mt-4 grid gap-2"
          >
            <div
              v-for="reason in purchaseReasons"
              :key="reason.code"
              class="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-caption text-warning"
            >
              {{ reasonLabel(reason) }}
            </div>
          </div>

          <label
            v-if="requiresRiskAcknowledge"
            class="mt-4 flex items-start gap-2 text-caption text-text-muted"
          >
            <input
              v-model="confirmingRiskModel"
              class="mt-1"
              type="checkbox"
            />
            <span>{{ t("purchase.riskyAcknowledge") }}</span>
          </label>

          <AirButton
            class="mt-4 w-full"
            :disabled="!canConfirmPurchase || isPreviewLoading"
            :label="isPurchasing ? t('fleet.action.purchasing') : t('action.confirmPurchase')"
            @click="emit('confirm-purchase')"
          />
        </section>

        <section class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ t("fleet.base.title") }}
          </h2>
          <p class="mt-2 text-body text-text-muted">
            {{ market.baseAirport?.label ?? "-" }}
          </p>
          <div class="mt-3 grid gap-2 text-caption text-text-muted">
            <span>{{ t("metric.balance") }}: {{ formatMoney(market.airline.balance) }}</span>
            <span>{{ t("fleet.market.affordable") }}: {{ formatNumber(market.summary.affordableTypes) }}</span>
            <span>{{ t("fleet.market.compatible") }}: {{ formatNumber(market.summary.baseCompatibleTypes) }}</span>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.fleet-order-grid {
  display: grid;
  gap: 1rem;
}

@media (min-width: 1280px) {
  .fleet-order-grid {
    grid-template-columns: minmax(0, 1fr) 26rem;
  }
}
</style>
