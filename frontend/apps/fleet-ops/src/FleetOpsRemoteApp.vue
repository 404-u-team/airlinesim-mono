<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import FleetAircraftDetailView from "./components/FleetAircraftDetailView.vue";
import FleetAircraftListView from "./components/FleetAircraftListView.vue";
import FleetOrderView from "./components/FleetOrderView.vue";
import FleetOverviewView from "./components/FleetOverviewView.vue";
import OperationsRouter from "./components/OperationsRouter.vue";
import { useFleetController } from "./fleet-controller";

const props = defineProps<{
  appLocale: Locale;
  appTheme?: "dark" | "light";
  shellPath?: string;
}>();

const controller = useFleetController(props);
</script>

<template>
  <OperationsRouter
    v-if="controller.activeMode !== 'fleet'"
    :app-locale="props.appLocale"
    :app-theme="props.appTheme"
    :flight-detail-id="controller.flightDetailId"
    :mode="controller.activeMode"
    :shell-path="props.shellPath"
    :t="controller.t"
  />

  <section
    v-else
    class="h-full overflow-y-auto bg-background p-3 text-body text-text-primary sm:p-4"
  >
    <div class="mx-auto flex min-h-full max-w-[112rem] flex-col gap-4">
      <FleetOverviewView
        v-if="controller.fleetPage === 'overview'"
        :aircraft="controller.fleetAircraft"
        :error="controller.error"
        :format-money="controller.formatMoney"
        :format-number="controller.formatNumber"
        :format-percent="controller.formatPercent"
        :is-loading="controller.isLoading"
        :market="controller.market"
        :message="controller.message"
        :t="controller.t"
        @navigate="controller.navigateTo"
        @refresh="controller.loadMarket"
      />

      <FleetAircraftListView
        v-else-if="controller.fleetPage === 'aircraft-list'"
        :aircraft="controller.fleetAircraft"
        :error="controller.error"
        :format-number="controller.formatNumber"
        :format-percent="controller.formatPercent"
        :is-loading="controller.isLoading"
        :t="controller.t"
        @navigate="controller.navigateTo"
        @refresh="controller.loadAircraft"
      />

      <FleetAircraftDetailView
        v-else-if="controller.fleetPage === 'aircraft-detail'"
        :aircraft="controller.detailAircraft"
        :edit-tail-number="controller.editTailNumber"
        :error="controller.error"
        :format-number="controller.formatNumber"
        :format-percent="controller.formatPercent"
        :is-loading="controller.isLoading"
        :is-tail-saving="controller.isTailSaving"
        :t="controller.t"
        @navigate="controller.navigateTo"
        @refresh="() => controller.loadAircraftDetail(controller.detailAircraftId)"
        @save="controller.saveTailNumber"
        @update-edit-tail-number="controller.editTailNumber = $event"
      />

      <FleetOrderView
        v-else
        :can-confirm-purchase="controller.canConfirmPurchase"
        :error="controller.error"
        :filters="controller.filters"
        :format-money="controller.formatMoney"
        :format-number="controller.formatNumber"
        :hub-options="controller.hubOptions"
        :is-confirming-risk="controller.isConfirmingRisk"
        :is-loading="controller.isLoading"
        :is-preview-loading="controller.isPreviewLoading"
        :is-purchasing="controller.isPurchasing"
        :market="controller.market"
        :message="controller.message"
        :preview="controller.preview"
        :purchase-reasons="controller.purchaseReasons"
        :reason-label="controller.reasonLabel"
        :requires-risk-acknowledge="controller.requiresRiskAcknowledge"
        :selected-type="controller.selectedType"
        :selected-type-id="controller.selectedTypeId"
        :sort-options="controller.sortOptions"
        :status-label="controller.statusLabel"
        :status-variant="controller.statusVariant"
        :t="controller.t"
        :tail-number="controller.tailNumber"
        @confirm-purchase="controller.confirmPurchase"
        @navigate="controller.navigateTo"
        @refresh="controller.loadMarket"
        @select-type="controller.selectType"
        @update-confirming-risk="controller.isConfirmingRisk = $event"
        @update-filter="controller.updateFilter"
        @update-tail-number="controller.tailNumber = $event"
      />
    </div>
  </section>
</template>
