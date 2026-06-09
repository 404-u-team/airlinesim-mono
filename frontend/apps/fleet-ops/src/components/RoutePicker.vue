<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirCombobox, type AirComboboxOption, AirSelect } from "@airlinesim/air-ui";
import { computed, onMounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { HubOption, OperationRoute, RouteAirportRef, RouteOpportunityItem } from "../types";

import { getHubs, getRouteOpportunities } from "../api";
import HubMapPanel from "./HubMapPanel.vue";

const props = defineProps<{
  appLocale: Locale;
  appTheme?: "dark" | "light";
  existingRoutes: OperationRoute[];
  initialDestinationId?: string;
  initialOriginId?: string;
  selectedAircraftId: string;
  t: (key: FleetMessageKey | string) => string;
}>();

const emit = defineEmits<{
  "route-resolved": [route: OperationRoute];
}>();

const hubs = ref<HubOption[]>([]);
const opportunities = ref<RouteOpportunityItem[]>([]);
const originAirport = ref<null | RouteAirportRef>(null);
const originId = ref(props.initialOriginId ?? "");
const destinationId = ref("");
const query = ref("");
const error = ref("");
const isLoading = ref(false);

const hubOptions = computed(() => hubs.value.map((hub) => ({ label: hub.label, value: hub.airport_id })));
const selectedHub = computed(() => hubs.value.find((hub) => hub.airport_id === originId.value) ?? null);
const selectedDestinationAirport = computed(() =>
  opportunities.value.find((item) => item.destination_airport.id === destinationId.value)?.destination_airport ?? null);
const airportFees = computed(() => {
  const airport = originAirport.value;
  if (!airport) {
    return null;
  }

  return (airport.runway_fee ?? 0) + (airport.gate_fee ?? 0) + (airport.stand_fee ?? 0);
});
const destinationOptions = computed<AirComboboxOption[]>(() => {
  const text = query.value.trim().toLowerCase();

  return opportunities.value
    .filter((item) => !text || optionText(item).toLowerCase().includes(text))
    .slice(0, 60)
    .map((item) => ({
      label: `${item.destination_airport.iata_code ?? "---"} - ${item.destination_airport.label}`,
      sub: `${formatNumber(item.demand.distance_km)} ${props.t("unit.km")} · ${formatNumber(item.demand.origin_daily_passengers)} ${props.t("operations.metric.pax")}/${props.t("unit.day")} · ${formatMoney(item.economics.estimated_profit_per_flight)}`,
      value: item.destination_airport.id ?? "",
    }));
});

onMounted(() => {
  void initialize();
});

watch(originId, () => {
  destinationId.value = "";
  void loadOpportunities();
});

watch(destinationId, () => {
  resolveRoute();
});

function formatMoney(value: number): string {
  return new Intl.NumberFormat(props.appLocale, { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(props.appLocale, { maximumFractionDigits: 0 }).format(value);
}

async function initialize(): Promise<void> {
  try {
    hubs.value = (await getHubs()).hubs;
  } catch {
    error.value = props.t("error.operations");
  }
  originId.value = props.initialOriginId || hubs.value.find((hub) => hub.is_base)?.airport_id || hubs.value[0]?.airport_id || "";
  await loadOpportunities();
  if (props.initialDestinationId) {
    destinationId.value = props.initialDestinationId;
  }
}

async function loadOpportunities(): Promise<void> {
  if (!originId.value) {
    return;
  }
  isLoading.value = true;
  error.value = "";
  try {
    const response = await getRouteOpportunities(originId.value, props.selectedAircraftId || undefined);
    opportunities.value = response.opportunities;
    originAirport.value = response.origin_airport ?? response.opportunities[0]?.origin_airport ?? null;
  } catch {
    error.value = props.t("error.operations");
  } finally {
    isLoading.value = false;
  }
}

function optionText(item: RouteOpportunityItem): string {
  return `${item.destination_airport.iata_code ?? ""} ${item.destination_airport.label}`;
}

function resolveRoute(): void {
  if (!originId.value || !destinationId.value) {
    return;
  }
  const existing = props.existingRoutes.find(
    (route) => route.origin_airport_id === originId.value && route.destination_airport_id === destinationId.value,
  );
  if (existing) {
    emit("route-resolved", existing);
    return;
  }
  const opportunity = opportunities.value.find((item) => item.destination_airport.id === destinationId.value);
  if (opportunity) {
    emit("route-resolved", toPendingRoute(opportunity));
  }
}

function toPendingRoute(opportunity: RouteOpportunityItem): OperationRoute {
  return {
    demand_snapshot: {
      distance_km: opportunity.demand.distance_km,
      origin_daily_passengers: opportunity.demand.origin_daily_passengers,
    },
    destination_airport: { iata_code: opportunity.destination_airport.iata_code, label: opportunity.destination_airport.label },
    destination_airport_id: opportunity.destination_airport.id ?? destinationId.value,
    economics_snapshot: { estimated_profit_per_flight: opportunity.economics.estimated_profit_per_flight },
    id: `pending:${originId.value}:${destinationId.value}`,
    origin_airport: { iata_code: opportunity.origin_airport.iata_code, label: opportunity.origin_airport.label },
    origin_airport_id: opportunity.origin_airport.id ?? originId.value,
    status: "awaiting_schedule",
  };
}
</script>

<template>
  <div class="grid gap-3">
    <AirSelect
      v-model="originId"
      :label="props.t('operations.routePicker.origin')"
      :options="hubOptions"
    />
    <AirCombobox
      :empty-text="props.t('operations.routePicker.empty')"
      :label="props.t('operations.routePicker.destination')"
      :loading="isLoading"
      :model-value="destinationId"
      :options="destinationOptions"
      :placeholder="props.t('operations.routePicker.destinationPlaceholder')"
      @search="query = $event"
      @update:model-value="destinationId = $event"
    >
      <template #option="{ option }">
        <div class="px-4 py-2.5">
          <p class="text-body">
            {{ option.label }}
          </p>
          <p class="text-caption text-text-muted">
            {{ (option as { sub?: string }).sub }}
          </p>
        </div>
      </template>
    </AirCombobox>
    <p
      v-if="error"
      class="text-caption text-error"
    >
      {{ error }}
    </p>

    <div
      v-if="originAirport || selectedHub"
      class="grid gap-2 rounded-md border border-border bg-background p-3"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="min-w-0 truncate text-body font-semibold">
          {{ originAirport?.label ?? selectedHub?.label }}
        </p>
        <AirBadge
          v-if="selectedHub?.is_base"
          :label="props.t('operations.hub.base')"
          size="sm"
          variant="primary-soft"
        />
      </div>
      <p
        v-if="originAirport?.municipality"
        class="text-caption text-text-muted"
      >
        {{ originAirport.municipality }}
      </p>
      <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
        <div class="flex items-center justify-between gap-2">
          <dt class="text-text-muted">
            {{ props.t("operations.hub.price") }}
          </dt>
          <dd class="font-medium">
            {{ selectedHub ? (selectedHub.is_base ? props.t("operations.hub.free") : formatMoney(selectedHub.fee)) : "—" }}
          </dd>
        </div>
        <div
          v-if="airportFees !== null"
          class="flex items-center justify-between gap-2"
        >
          <dt class="text-text-muted">
            {{ props.t("operations.hub.fees") }}
          </dt>
          <dd class="font-medium">
            {{ formatMoney(airportFees) }}
          </dd>
        </div>
        <div
          v-if="originAirport?.max_runway_length_m"
          class="flex items-center justify-between gap-2"
        >
          <dt class="text-text-muted">
            {{ props.t("operations.hub.runway") }}
          </dt>
          <dd class="font-medium">
            {{ formatNumber(originAirport.max_runway_length_m) }} {{ props.t("unit.m") }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-2">
          <dt class="text-text-muted">
            {{ props.t("operations.hub.nightOps") }}
          </dt>
          <dd class="font-medium">
            {{ originAirport?.works_at_night === false ? props.t("operations.hub.no") : props.t("operations.hub.yes") }}
          </dd>
        </div>
        <div
          v-if="selectedHub"
          class="flex items-center justify-between gap-2"
        >
          <dt class="text-text-muted">
            {{ props.t("operations.hub.routes") }}
          </dt>
          <dd class="font-medium">
            {{ formatNumber(selectedHub.routes) }}
          </dd>
        </div>
        <div
          v-if="selectedHub"
          class="flex items-center justify-between gap-2"
        >
          <dt class="text-text-muted">
            {{ props.t("operations.hub.profit") }}
          </dt>
          <dd
            class="font-medium"
            :class="selectedHub.profit >= 0 ? 'text-success' : 'text-error'"
          >
            {{ formatMoney(selectedHub.profit) }}
          </dd>
        </div>
      </dl>
    </div>

    <HubMapPanel
      :app-theme="props.appTheme ?? 'light'"
      :destination-airport="selectedDestinationAirport"
      :origin-airport="originAirport"
      :t="props.t"
    />
  </div>
</template>
