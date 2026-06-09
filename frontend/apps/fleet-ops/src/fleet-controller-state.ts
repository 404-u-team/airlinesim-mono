import { type Locale, translate } from "@airlinesim/i18n";
import { computed, reactive, ref } from "vue";

import type {
  FleetMarketResponse,
  FleetOwnedAircraftCard,
  FleetPurchasePreviewResponse,
  HubOption,
} from "./types";

import { type FleetMessageKey, fleetMessages } from "./i18n";

export type FleetControllerProps = {
  appLocale: Locale;
  shellPath?: string;
};

export type FleetPage = "aircraft-detail" | "aircraft-list" | "order" | "overview";

const operationModeByPrefix = [
  ["/operations/live-flights", "flights"],
  ["/operations/fuel", "fuel"],
  ["/operations/schedule", "schedule"],
] as const;

// eslint-disable-next-line max-lines-per-function, @typescript-eslint/explicit-function-return-type
export function createFleetControllerState(props: FleetControllerProps) {
  const aircraft = ref<FleetOwnedAircraftCard[]>([]);
  const detailAircraft = ref<FleetOwnedAircraftCard | null>(null);
  const editTailNumber = ref("");
  const error = ref("");
  const filters = reactive({
    baseAirportId: "",
    maxPrice: "",
    minCapacity: "",
    minRange: "",
    q: "",
    sort: "recommended",
  });
  const hubs = ref<HubOption[]>([]);
  const isConfirmingRisk = ref(false);
  const isLoading = ref(false);
  const isPreviewLoading = ref(false);
  const isPurchasing = ref(false);
  const isTailSaving = ref(false);
  const market = ref<FleetMarketResponse | null>(null);
  const message = ref("");
  const preview = ref<FleetPurchasePreviewResponse | null>(null);
  const selectedTypeId = ref("");
  const tailNumber = ref("");

  const currentPath = computed(() => normalizePath(props.shellPath));
  const activeMode = computed<"fleet" | "flights" | "fuel" | "schedule">(() =>
    operationModeByPrefix.find(([prefix]) => currentPath.value.startsWith(prefix))?.[1] ?? "fleet",
  );
  const detailAircraftId = computed(() => {
    const match = /^\/fleet\/aircraft\/([^/?#]+)/.exec(currentPath.value);

    return match?.[1] ? decodeURIComponent(match[1]) : "";
  });
  const fleetPage = computed<FleetPage>(() => resolveFleetPage(currentPath.value, detailAircraftId.value));
  const requiresRiskAcknowledge = computed(() =>
    Boolean(preview.value?.warnings.some((warning) => warning.code === "FLEET_RESERVE_RISK")),
  );
  const canConfirmPurchase = computed(() =>
    Boolean(preview.value?.canPurchase) &&
    !isPurchasing.value &&
    (!requiresRiskAcknowledge.value || isConfirmingRisk.value),
  );
  const fleetAircraft = computed(() => aircraft.value.length > 0 ? aircraft.value : market.value?.ownedAircraft ?? []);
  const hubOptions = computed(() => hubs.value.map((hub) => ({ label: hub.label, value: hub.airport_id })));
  const purchaseReasons = computed(() => [
    ...(preview.value?.blockingReasons ?? []),
    ...(preview.value?.warnings ?? []),
  ]);
  const selectedBaseAirportId = computed(() => market.value?.baseAirport?.id ?? "");
  const selectedType = computed(() =>
    market.value?.aircraftTypes.find((type) => type.id === selectedTypeId.value) ?? null,
  );
  const t = computed(() => (key: string): string =>
    translate(fleetMessages, props.appLocale, key as FleetMessageKey),
  );
  const sortOptions = computed(() => [
    { label: t.value("filter.sort.recommended"), value: "recommended" },
    { label: t.value("filter.sort.price"), value: "price" },
    { label: t.value("filter.sort.capacity"), value: "capacity" },
    { label: t.value("filter.sort.range"), value: "range" },
  ]);

  return {
    activeMode,
    aircraft,
    canConfirmPurchase,
    detailAircraft,
    detailAircraftId,
    editTailNumber,
    error,
    filters,
    fleetAircraft,
    fleetPage,
    hubOptions,
    hubs,
    isConfirmingRisk,
    isLoading,
    isPreviewLoading,
    isPurchasing,
    isTailSaving,
    market,
    message,
    preview,
    purchaseReasons,
    requiresRiskAcknowledge,
    selectedBaseAirportId,
    selectedType,
    selectedTypeId,
    sortOptions,
    t,
    tailNumber,
  };
}

function normalizePath(path: string | undefined): string {
  const normalized = path?.split("?")[0] ?? "/fleet/overview";

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function resolveFleetPage(path: string, aircraftId: string): FleetPage {
  if (path.startsWith("/fleet/order/new")) {
    return "order";
  }
  if (aircraftId) {
    return "aircraft-detail";
  }
  if (path.startsWith("/fleet/aircraft")) {
    return "aircraft-list";
  }

  return "overview";
}
