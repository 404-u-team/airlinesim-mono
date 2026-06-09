import { airlineSimEventBus } from "@airlinesim/event-bus";
import { onMounted, onUnmounted, reactive, watch } from "vue";

import type {
  FleetMarketAircraftType,
  FleetOwnedAircraftCard,
  FleetReason,
} from "./types";

import {
  getFleetAircraft,
  getFleetAircraftDetail,
  getFleetMarket,
  getFleetPurchasePreview,
  getHubs,
  purchaseFleetAircraft,
  updateFleetAircraftTailNumber,
} from "./api";
import { createFleetControllerState, type FleetControllerProps } from "./fleet-controller-state";
import {
  emitAircraftPurchased,
  emitFleetInvalidations,
  getFleetErrorMessage,
  getNextSelectedTypeId,
} from "./fleet-controller-utils";
import { formatMoneyValue, formatNumberValue, formatPercentValue } from "./formatters";
import { type FleetMessageKey, fleetMessages } from "./i18n";
import { getStatusVariant } from "./status";

// eslint-disable-next-line max-lines-per-function, @typescript-eslint/explicit-function-return-type
export function useFleetController(props: FleetControllerProps) {
  const state = createFleetControllerState(props);
  const {
    activeMode,
    aircraft,
    canConfirmPurchase,
    detailAircraft,
    detailAircraftId,
    editTailNumber,
    error,
    filters,
    fleetPage,
    hubs,
    isConfirmingRisk,
    isLoading,
    isPreviewLoading,
    isPurchasing,
    isTailSaving,
    market,
    message,
    preview,
    selectedBaseAirportId,
    selectedTypeId,
    t,
    tailNumber,
  } = state;

  let marketDebounce: null | ReturnType<typeof setTimeout> = null;
  let previewDebounce: null | ReturnType<typeof setTimeout> = null;
  let unsubscribeAirportSelected: (() => void) | null = null;

  onMounted(() => {
    airlineSimEventBus.emit("mfe:ready", { remoteId: "fleet-ops" });
    unsubscribeAirportSelected = airlineSimEventBus.on("map:airport-selected", handleMapAirportSelected);
    void loadActiveFleetPage();
  });

  onUnmounted(() => {
    if (marketDebounce) {
      clearTimeout(marketDebounce);
    }
    if (previewDebounce) {
      clearTimeout(previewDebounce);
    }
    unsubscribeAirportSelected?.();
  });

  watch([activeMode, fleetPage, detailAircraftId], () => {
    void loadActiveFleetPage();
  });

  watch(filters, queueMarketReload, { deep: true });
  watch([selectedTypeId, tailNumber], queuePreviewReload);

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
      await Promise.all([loadMarket(), loadAircraft()]);
      if (response.aircraft?.id) {
        navigateTo(`/fleet/aircraft/${encodeURIComponent(response.aircraft.id)}`);
      }
    } catch (purchaseError) {
      error.value = apiErrorMessage(purchaseError, "error.purchase");
    } finally {
      isPurchasing.value = false;
    }
  }

  async function loadActiveFleetPage(): Promise<void> {
    if (activeMode.value !== "fleet") {
      return;
    }

    if (fleetPage.value === "aircraft-detail") {
      await loadAircraftDetail(detailAircraftId.value);
      return;
    }
    if (fleetPage.value === "aircraft-list") {
      await loadAircraft();
      return;
    }

    if (fleetPage.value === "order") {
      await loadHubs();
    }
    await loadMarket();
  }

  function handleMapAirportSelected(payload: { airportId: string }): void {
    if (activeMode.value !== "fleet" || fleetPage.value !== "order") {
      return;
    }
    // Delivery base must be one of the airline's hubs, so ignore clicks on other airports.
    if (!hubs.value.some((hub) => hub.airport_id === payload.airportId)) {
      return;
    }
    filters.baseAirportId = payload.airportId;
    void loadMarket();
  }

  async function loadHubs(): Promise<void> {
    try {
      const response = await getHubs();
      hubs.value = response.hubs;
      // Default the delivery base to the airline's base hub when nothing is picked yet.
      if (!filters.baseAirportId && response.hubs.length > 0) {
        filters.baseAirportId = (response.hubs.find((hub) => hub.is_base) ?? response.hubs[0]).airport_id;
      }
    } catch {
      hubs.value = [];
    }
  }

  async function loadAircraft(): Promise<void> {
    isLoading.value = true;
    error.value = "";

    try {
      const response = await getFleetAircraft();
      aircraft.value = response.aircraft;
    } catch (loadError) {
      error.value = apiErrorMessage(loadError, "error.load");
    } finally {
      isLoading.value = false;
    }
  }

  async function loadAircraftDetail(id: string): Promise<void> {
    if (!id) {
      detailAircraft.value = null;
      editTailNumber.value = "";
      return;
    }

    isLoading.value = true;
    error.value = "";

    try {
      const detail = await getFleetAircraftDetail(id);
      applyDetailAircraft(detail.aircraft);
    } catch (loadError) {
      error.value = apiErrorMessage(loadError, "error.load");
      detailAircraft.value = aircraft.value.find((item) => item.id === id) ?? null;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadMarket(): Promise<void> {
    isLoading.value = true;
    error.value = "";

    try {
      const response = await getFleetMarket(filters);
      market.value = response;
      aircraft.value = response.ownedAircraft;
      selectedTypeId.value = getNextSelectedTypeId(response, selectedTypeId.value);

      if (!tailNumber.value && response.ownedAircraft.length === 0) {
        tailNumber.value = "HL-001";
      }

      if (fleetPage.value === "order") {
        await loadPreview();
      }
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

  async function saveTailNumber(): Promise<void> {
    const aircraftId = detailAircraft.value?.id;
    const requestedTailNumber = editTailNumber.value;

    if (!aircraftId) {
      return;
    }

    isTailSaving.value = true;
    error.value = "";

    try {
      const response = await updateFleetAircraftTailNumber(aircraftId, requestedTailNumber);
      applyDetailAircraft(response.aircraft);
      await loadAircraft();
    } catch (tailError) {
      error.value = apiErrorMessage(tailError, "error.tail");
    } finally {
      isTailSaving.value = false;
    }
  }

  return reactive({
    ...state,
    confirmPurchase,
    formatMoney,
    formatNumber,
    formatPercent,
    loadAircraft,
    loadAircraftDetail,
    loadMarket,
    navigateTo,
    reasonLabel,
    saveTailNumber,
    selectType,
    statusLabel,
    statusVariant,
    updateFilter,
  });

  function apiErrorMessage(value: unknown, fallback: FleetMessageKey): string {
    return getFleetErrorMessage(value, fallback, t.value);
  }

  function applyDetailAircraft(nextAircraft: FleetOwnedAircraftCard): void {
    detailAircraft.value = nextAircraft;
    editTailNumber.value = nextAircraft.tail_number ?? "";
  }

  function formatMoney(value: number | undefined): string {
    return formatMoneyValue(props.appLocale, value);
  }

  function formatNumber(value: number | undefined): string {
    return formatNumberValue(props.appLocale, value);
  }

  function formatPercent(value: number | undefined): string {
    return formatPercentValue(props.appLocale, value);
  }

  function handlePurchaseSuccess(ownedAircraft: FleetOwnedAircraftCard | null, price: number): void {
    message.value = t.value("purchase.success");
    tailNumber.value = "";
    preview.value = null;
    isConfirmingRisk.value = false;

    if (ownedAircraft) {
      applyDetailAircraft(ownedAircraft);
      emitAircraftPurchased(ownedAircraft, price);
    }

    emitFleetInvalidations(t.value("purchase.success"));
  }

  function navigateTo(path: string): void {
    airlineSimEventBus.emit("navigation:intent", {
      source: "mfe",
      targetPath: path,
    });
  }

  function queueMarketReload(): void {
    if (activeMode.value !== "fleet" || fleetPage.value !== "order") {
      return;
    }
    if (marketDebounce) {
      clearTimeout(marketDebounce);
    }
    marketDebounce = setTimeout(() => void loadMarket(), 250);
  }

  function queuePreviewReload(): void {
    if (activeMode.value !== "fleet" || fleetPage.value !== "order") {
      return;
    }
    if (previewDebounce) {
      clearTimeout(previewDebounce);
    }
    previewDebounce = setTimeout(() => void loadPreview(), 250);
  }

  function reasonLabel(reason: FleetReason): string {
    const key = `warning.${reason.code}` as FleetMessageKey;

    return key in fleetMessages.en ? t.value(key) : reason.message;
  }

  function selectType(type: FleetMarketAircraftType): void {
    selectedTypeId.value = type.id ?? "";
  }

  function statusLabel(status: FleetMarketAircraftType["compatibility"]["status"]): string {
    return t.value(`status.${status}`);
  }

  function statusVariant(
    status: FleetMarketAircraftType["compatibility"]["status"],
  ): ReturnType<typeof getStatusVariant> {
    return getStatusVariant(status);
  }

  function updateFilter(key: keyof typeof filters, value: string): void {
    filters[key] = value;
  }
}
