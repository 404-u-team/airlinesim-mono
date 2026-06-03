<script setup lang="ts">
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, onMounted, reactive, ref, watch } from "vue";

import type {
  FleetMarketAircraftType,
  FleetMarketResponse,
  FleetOwnedAircraftCard,
  FleetPurchasePreviewResponse,
  FleetReason,
} from "./types";

import {
  getFleetAircraftDetail,
  getFleetMarket,
  getFleetPurchasePreview,
  purchaseFleetAircraft,
  updateFleetAircraftTailNumber,
} from "./api";
import FleetMarketView from "./components/FleetMarketView.vue";
import OperationsRouter from "./components/OperationsRouter.vue";
import { formatMoneyValue, formatNumberValue, formatPercentValue } from "./formatters";
import { type FleetMessageKey, fleetMessages } from "./i18n";

type StatusVariant = "danger-soft" | "primary-soft" | "success-soft" | "warning-soft";

const props = defineProps<{
  appLocale: Locale;
  shellPath?: string;
}>();

const editTailNumber = ref("");
const error = ref("");
const filters = reactive({
  maxPrice: "",
  minCapacity: "",
  minRange: "",
  q: "",
  sort: "recommended",
});
const isConfirmingRisk = ref(false);
const isLoading = ref(false);
const isPreviewLoading = ref(false);
const isPurchasing = ref(false);
const isTailSaving = ref(false);
const market = ref<FleetMarketResponse | null>(null);
const message = ref("");
const preview = ref<FleetPurchasePreviewResponse | null>(null);
const selectedAircraft = ref<FleetOwnedAircraftCard | null>(null);
const selectedTypeId = ref("");
const tailNumber = ref("");

let marketDebounce: null | ReturnType<typeof setTimeout> = null;
let previewDebounce: null | ReturnType<typeof setTimeout> = null;

const canConfirmPurchase = computed(() =>
  Boolean(preview.value?.canPurchase) &&
  !isPurchasing.value &&
  (!requiresRiskAcknowledge.value || isConfirmingRisk.value),
);
const purchaseReasons = computed(() => [
  ...(preview.value?.blockingReasons ?? []),
  ...(preview.value?.warnings ?? []),
]);
const requiresRiskAcknowledge = computed(() =>
  Boolean(preview.value?.warnings.some((warning) => warning.code === "FLEET_RESERVE_RISK")),
);
const selectedBaseAirportId = computed(() => market.value?.baseAirport?.id ?? "");
const selectedType = computed(() =>
  market.value?.aircraftTypes.find((type) => type.id === selectedTypeId.value) ?? null,
);
const sortOptions = computed(() => [
  { label: t.value("filter.sort.recommended"), value: "recommended" },
  { label: t.value("filter.sort.price"), value: "price" },
  { label: t.value("filter.sort.capacity"), value: "capacity" },
  { label: t.value("filter.sort.range"), value: "range" },
]);
const t = computed(() => (key: FleetMessageKey | string): string =>
  translate(fleetMessages, props.appLocale, key as FleetMessageKey),
);
const activeMode = computed<"fleet" | "flights" | "schedule">(() => {
  if (props.shellPath?.startsWith("/operations/live-flights")) {
    return "flights";
  }
  if (props.shellPath?.startsWith("/operations/schedule")) {
    return "schedule";
  }

  return "fleet";
});

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "fleet-ops" });
  void loadMarket();
});

watch(
  filters,
  () => {
    if (marketDebounce) {
      clearTimeout(marketDebounce);
    }
    marketDebounce = setTimeout(() => void loadMarket(), 250);
  },
  { deep: true },
);

watch([selectedTypeId, tailNumber], () => {
  if (previewDebounce) {
    clearTimeout(previewDebounce);
  }
  previewDebounce = setTimeout(() => void loadPreview(), 250);
});

function apiErrorMessage(value: unknown, fallback: FleetMessageKey): string {
  const errorPayload = getErrorPayload(value);

  if (errorPayload?.code) {
    const key = `warning.${errorPayload.code}` as FleetMessageKey;
    if (key in fleetMessages.en) {
      return t.value(key);
    }
  }

  return errorPayload?.message ?? t.value(fallback);
}

async function confirmPurchase(): Promise<void> {
  const baseAirportId = selectedBaseAirportId.value;
  const typeId = selectedTypeId.value;
  const requestedTailNumber = preview.value?.tailNumber.normalizedValue ?? tailNumber.value;

  if (!canConfirmPurchase.value || !typeId || !baseAirportId) {
    return;
  }

  isPurchasing.value = true;
  error.value = "";
  message.value = "";

  try {
    const response = await purchaseFleetAircraft({
      aircraft_type_id: typeId,
      base_airport_id: baseAirportId,
      tail_number: requestedTailNumber,
    });
    handlePurchaseSuccess(response.aircraft, response.finance.aircraftPrice);
    await loadMarket();
  } catch (purchaseError) {
    error.value = apiErrorMessage(purchaseError, "error.purchase");
  } finally {
    isPurchasing.value = false;
  }
}

function formatMoney(value: number | undefined): string { return formatMoneyValue(props.appLocale, value); }

function formatNumber(value: number | undefined): string { return formatNumberValue(props.appLocale, value); }

function formatPercent(value: number | undefined): string { return formatPercentValue(props.appLocale, value); }

function getErrorPayload(value: unknown): null | { code?: string; message?: string } {
  if (!value || typeof value !== "object") {
    return null;
  }

  const { data } = value as { data?: unknown };
  if (!data || typeof data !== "object") {
    return null;
  }

  const { error: payload } = data as { error?: { code?: string; message?: string } };

  return payload ?? null;
}

function getNextSelectedTypeId(response: FleetMarketResponse): string {
  const currentTypeAvailable = response.aircraftTypes.some((type) => type.id === selectedTypeId.value);

  return currentTypeAvailable
    ? selectedTypeId.value
    : response.summary.recommendedTypeId ?? response.aircraftTypes[0]?.id ?? "";
}

function handlePurchaseSuccess(aircraft: FleetOwnedAircraftCard | null, price: number): void {
  message.value = t.value("purchase.success");
  tailNumber.value = "";
  preview.value = null;
  isConfirmingRisk.value = false;

  if (aircraft) {
    setSelectedAircraft(aircraft);
    airlineSimEventBus.emit("fleet:aircraft-purchased", {
      aircraftId: aircraft.id,
      baseAirportId: aircraft.base_airport_id,
      modelName: aircraft.modelName,
      price,
      tailNumber: aircraft.tail_number,
      typeId: aircraft.type_id,
    });
  }

  airlineSimEventBus.emit("game:snapshot-invalidated", {
    reason: "aircraft-purchased",
    source: "fleet-ops",
  });
  airlineSimEventBus.emit("map:network-refresh-requested", {
    reason: "aircraft-purchased",
    source: "fleet-ops",
  });
  airlineSimEventBus.emit("notification:created", {
    message: t.value("purchase.success"),
    severity: "success",
  });
}

async function loadMarket(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const response = await getFleetMarket(filters);
    market.value = response;
    selectedTypeId.value = getNextSelectedTypeId(response);

    if (!tailNumber.value && response.ownedAircraft.length === 0) {
      tailNumber.value = "HL-001";
    }

    await loadPreview();
  } catch (loadError) {
    error.value = apiErrorMessage(loadError, "error.load");
  } finally {
    isLoading.value = false;
  }
}

async function loadPreview(): Promise<void> {
  const baseAirportId = selectedBaseAirportId.value;
  const requestedTailNumber = tailNumber.value;
  const typeId = selectedTypeId.value;

  if (!typeId || !baseAirportId) {
    preview.value = null;
    return;
  }

  isPreviewLoading.value = true;

  try {
    const response = await getFleetPurchasePreview(typeId, baseAirportId, requestedTailNumber);
    preview.value = response;
    isConfirmingRisk.value = false;
  } catch (loadError) {
    error.value = apiErrorMessage(loadError, "error.load");
  } finally {
    isPreviewLoading.value = false;
  }
}

async function openAircraft(aircraft: FleetOwnedAircraftCard): Promise<void> {
  const aircraftId = aircraft.id;

  if (!aircraftId) {
    selectedAircraft.value = aircraft;
    return;
  }

  try {
    const detail = await getFleetAircraftDetail(aircraftId);
    const detailAircraft = detail.aircraft;
    setSelectedAircraft(detailAircraft);
    editTailNumber.value = detailAircraft.tail_number ?? "";
  } catch {
    setSelectedAircraft(aircraft);
  }
}

function planRoute(): void {
  airlineSimEventBus.emit("navigation:intent", {
    source: "mfe",
    targetPath: "/airports/routes",
  });
}

function reasonLabel(reason: FleetReason): string {
  const key = `warning.${reason.code}` as FleetMessageKey;

  return key in fleetMessages.en ? t.value(key) : reason.message;
}

async function saveTailNumber(): Promise<void> {
  const aircraftId = selectedAircraft.value?.id;
  const requestedTailNumber = editTailNumber.value;

  if (!aircraftId) {
    return;
  }

  isTailSaving.value = true;
  error.value = "";

  try {
    const response = await updateFleetAircraftTailNumber(aircraftId, requestedTailNumber);
    setSelectedAircraft(response.aircraft);
    await loadMarket();
  } catch (tailError) {
    error.value = apiErrorMessage(tailError, "error.tail");
  } finally {
    isTailSaving.value = false;
  }
}

function selectType(type: FleetMarketAircraftType): void {
  selectedTypeId.value = type.id ?? "";
}

function setSelectedAircraft(aircraft: FleetOwnedAircraftCard | null): void {
  selectedAircraft.value = aircraft;
}

function statusLabel(status: FleetMarketAircraftType["compatibility"]["status"]): string {
  return t.value(`status.${status}`);
}

function statusVariant(status: FleetMarketAircraftType["compatibility"]["status"]): StatusVariant {
  const variants: Record<FleetMarketAircraftType["compatibility"]["status"], StatusVariant> = {
    available: "primary-soft",
    blocked: "danger-soft",
    recommended: "success-soft",
    risky: "warning-soft",
  };

  return variants[status];
}

function updateFilter(key: keyof typeof filters, value: string): void {
  filters[key] = value;
}
</script>

<template>
  <OperationsRouter
    v-if="activeMode !== 'fleet'"
    :app-locale="props.appLocale"
    :mode="activeMode"
    :t="t"
  />
  <FleetMarketView
    v-else
    :can-confirm-purchase="canConfirmPurchase"
    :edit-tail-number="editTailNumber"
    :error="error"
    :filters="filters"
    :format-money="formatMoney"
    :format-number="formatNumber"
    :format-percent="formatPercent"
    :is-confirming-risk="isConfirmingRisk"
    :is-loading="isLoading"
    :is-preview-loading="isPreviewLoading"
    :is-purchasing="isPurchasing"
    :is-tail-saving="isTailSaving"
    :market="market"
    :message="message"
    :preview="preview"
    :purchase-reasons="purchaseReasons"
    :reason-label="reasonLabel"
    :requires-risk-acknowledge="requiresRiskAcknowledge"
    :selected-aircraft="selectedAircraft"
    :selected-type="selectedType"
    :selected-type-id="selectedTypeId"
    :sort-options="sortOptions"
    :status-label="statusLabel"
    :status-variant="statusVariant"
    :tail-number="tailNumber"
    :t="t"
    @close-detail="selectedAircraft = null"
    @confirm-purchase="confirmPurchase"
    @load-market="loadMarket"
    @open-aircraft="openAircraft"
    @plan-route="planRoute"
    @save-tail-number="saveTailNumber"
    @select-type="selectType"
    @update-confirming-risk="isConfirmingRisk = $event"
    @update-edit-tail-number="editTailNumber = $event"
    @update-filter="updateFilter"
    @update-tail-number="tailNumber = $event"
  />
</template>
