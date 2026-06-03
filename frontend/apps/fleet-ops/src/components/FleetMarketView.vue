<script setup lang="ts">
import type {
  FleetMarketAircraftType,
  FleetMarketResponse,
  FleetOwnedAircraftCard,
  FleetPurchasePreviewResponse,
  FleetReason,
} from "../types";

type StatusVariant = "danger-soft" | "primary-soft" | "success-soft" | "warning-soft";

import AircraftMarketList from "./AircraftMarketList.vue";
import FleetLoadingSkeleton from "./FleetLoadingSkeleton.vue";
import FleetMarketToolbar from "./FleetMarketToolbar.vue";
import FleetSidebar from "./FleetSidebar.vue";

defineProps<{
  canConfirmPurchase: boolean;
  editTailNumber: string;
  error: string;
  filters: { maxPrice: string; minCapacity: string; minRange: string; q: string; sort: string };
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  formatPercent: (value: number | undefined) => string;
  isConfirmingRisk: boolean;
  isLoading: boolean;
  isPreviewLoading: boolean;
  isPurchasing: boolean;
  isTailSaving: boolean;
  market: FleetMarketResponse | null;
  message: string;
  preview: FleetPurchasePreviewResponse | null;
  purchaseReasons: FleetReason[];
  reasonLabel: (reason: FleetReason) => string;
  requiresRiskAcknowledge: boolean;
  selectedAircraft: FleetOwnedAircraftCard | null;
  selectedType: FleetMarketAircraftType | null;
  selectedTypeId: string;
  sortOptions: Array<{ label: string; value: string }>;
  statusLabel: (status: FleetMarketAircraftType["compatibility"]["status"]) => string;
  statusVariant: (status: FleetMarketAircraftType["compatibility"]["status"]) => StatusVariant;
  t: (key: string) => string;
  tailNumber: string;
}>();

const emit = defineEmits<{
  "close-detail": [];
  "confirm-purchase": [];
  "load-market": [];
  "open-aircraft": [aircraft: FleetOwnedAircraftCard];
  "plan-route": [];
  "save-tail-number": [];
  "select-type": [type: FleetMarketAircraftType];
  "update-confirming-risk": [value: boolean];
  "update-edit-tail-number": [value: string];
  "update-filter": [key: "maxPrice" | "minCapacity" | "minRange" | "q" | "sort", value: string];
  "update-tail-number": [value: string];
}>();
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <FleetMarketToolbar
      :error="error"
      :filters="filters"
      :format-money="formatMoney"
      :format-number="formatNumber"
      :is-loading="isLoading"
      :market="market"
      :message="message"
      :sort-options="sortOptions"
      :t="t"
      @refresh="emit('load-market')"
      @update-filter="(key, value) => emit('update-filter', key, value)"
    />

    <FleetLoadingSkeleton v-if="isLoading && !market" />

    <div
      v-else-if="market"
      class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]"
    >
      <div class="min-w-0">
        <AircraftMarketList
          :format-money="formatMoney"
          :format-number="formatNumber"
          :reason-label="reasonLabel"
          :selected-type-id="selectedTypeId"
          :status-label="statusLabel"
          :status-variant="statusVariant"
          :t="t"
          :types="market.aircraftTypes"
          @select-type="emit('select-type', $event)"
        />
      </div>

      <FleetSidebar
        :can-confirm-purchase="canConfirmPurchase"
        :edit-tail-number="editTailNumber"
        :format-money="formatMoney"
        :format-number="formatNumber"
        :format-percent="formatPercent"
        :is-confirming-risk="isConfirmingRisk"
        :is-preview-loading="isPreviewLoading"
        :is-purchasing="isPurchasing"
        :is-tail-saving="isTailSaving"
        :owned-aircraft="market.ownedAircraft"
        :preview="preview"
        :purchase-reasons="purchaseReasons"
        :reason-label="reasonLabel"
        :requires-risk-acknowledge="requiresRiskAcknowledge"
        :selected-aircraft="selectedAircraft"
        :selected-type="selectedType"
        :tail-number="tailNumber"
        :t="t"
        @close-detail="emit('close-detail')"
        @confirm-purchase="emit('confirm-purchase')"
        @load-market="emit('load-market')"
        @open-aircraft="emit('open-aircraft', $event)"
        @plan-route="emit('plan-route')"
        @save-tail-number="emit('save-tail-number')"
        @update-confirming-risk="emit('update-confirming-risk', $event)"
        @update-edit-tail-number="emit('update-edit-tail-number', $event)"
        @update-tail-number="emit('update-tail-number', $event)"
      />
    </div>
  </section>
</template>
