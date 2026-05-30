<script setup lang="ts">
/* eslint-disable max-lines */
import type {
  FleetpbAircraft,
  FleetpbAircraftType,
  FleetpbCreateAircraftResponse,
  FleetpbListAircraftsResponse,
  FleetpbListAircraftTypesResponse,
  OperationspbAirport,
  OperationspbListAirportsResponse,
} from "@airlinesim/api-contracts";

import { AirBadge, AirButton, AirSelect, AirTextField } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { ApiRequestError, createApiClient, createAuthClient } from "@airlinesim/game-sdk";
import { computed, onMounted, reactive, ref, watch } from "vue";

type AircraftSort = "capacity-desc" | "price-asc" | "range-desc";

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});

const aircraftTypes = ref<FleetpbAircraftType[]>([]);
const aircrafts = ref<FleetpbAircraft[]>([]);
const airports = ref<OperationspbAirport[]>([]);
const selectedTypeId = ref("");
const selectedBaseAirportId = ref("");
const message = ref("");
const error = ref("");
const isLoading = ref(false);
const isPurchasing = ref(false);
const filters = reactive({
  airportQuery: "",
  maxPrice: "",
  minCapacity: "",
  minRange: "",
  query: "",
  sort: "capacity-desc" as AircraftSort,
  tailNumber: "",
});

const selectedType = computed(() => aircraftTypes.value.find((type) => type.id === selectedTypeId.value));
const selectedBaseAirport = computed(() => airports.value.find((airport) => airport.id === selectedBaseAirportId.value));
const availableAircraftTypes = computed(() => {
  return aircraftTypes.value
    .filter(aircraftMatchesFilters)
    .sort(compareAircraftTypes);
});
const baseAirportOptions = computed(() => {
  const query = filters.airportQuery.trim().toLowerCase();
  const selectedRunwayMin = selectedType.value?.min_runway_length_m ?? 0;
  const filtered = airports.value
    .filter((airport) => airportMatchesFilter(airport, query, selectedRunwayMin))
    .slice(0, 80)
    .map(toAirportOption)
    .filter((option) => option.value);

  return [{ label: "Select base airport", value: "" }, ...filtered];
});
const selectedTypeOptions = computed(() => [
  { label: "Capacity", value: "capacity-desc" },
  { label: "Price", value: "price-asc" },
  { label: "Range", value: "range-desc" },
]);
const canPurchase = computed(
  () => Boolean(selectedTypeId.value && selectedBaseAirportId.value && filters.tailNumber.trim()) && !isPurchasing.value,
);
const selectedTypeSummary = computed(() => {
  if (!selectedType.value) {
    return "Select an aircraft type to see operating limits.";
  }

  return `${formatNumber(selectedType.value.max_planned_seat_capacity)} seats, ${formatNumber(selectedType.value.max_range_km)} km range, ${formatMoney(selectedType.value.price_per_unit)}`;
});
const ownedAircraftRows = computed(() =>
  aircrafts.value.map((aircraft) => ({
    ...aircraft,
    baseAirportName: airportName(aircraft.base_airport_id),
    modelName: typeNameById.value.get(aircraft.type_id ?? "") ?? aircraft.type_id ?? "-",
  })),
);
const typeNameById = computed(() => new Map(aircraftTypes.value.map((type) => [type.id ?? "", type.model_name ?? "-"])));

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "fleet-ops" });
  void loadFleetData();
});

watch(selectedTypeId, () => {
  const base = selectedBaseAirport.value;

  if (base && (base.max_runway_length_m ?? 0) < (selectedType.value?.min_runway_length_m ?? 0)) {
    selectedBaseAirportId.value = "";
  }
});

function aircraftMatchesFilters(type: FleetpbAircraftType): boolean {
  const query = filters.query.trim().toLowerCase();
  const text = `${type.model_name ?? ""} ${type.icao_code ?? ""} ${type.iata_code ?? ""}`.toLowerCase();
  const checks = [
    matchesQuery(text, query),
    meetsMinimum(type.max_range_km, filters.minRange),
    meetsMinimum(type.max_planned_seat_capacity, filters.minCapacity),
    meetsMaximum(type.price_per_unit, filters.maxPrice),
    meetsRunway(type.min_runway_length_m),
  ];

  return checks.every(Boolean);
}

function airportMatchesFilter(airport: OperationspbAirport, query: string, selectedRunwayMin: number): boolean {
  const text = `${airport.iata_code ?? ""} ${airport.icao_code ?? ""} ${airport.intl_name ?? ""} ${airport.municipality ?? ""}`.toLowerCase();

  return (!query || text.includes(query)) && (airport.max_runway_length_m ?? 0) >= selectedRunwayMin;
}

function airportName(id: string | undefined): string {
  const airport = airports.value.find((item) => item.id === id);

  return airport ? `${airport.iata_code || airport.icao_code || "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}` : id ?? "-";
}

function apiMessage(value: unknown, fallback: string): string {
  if (value instanceof ApiRequestError) {
    if (value.status === 401) {
      return "Sign in to manage fleet.";
    }

    if (value.status === 409) {
      return "Tail number already exists.";
    }

    return value.message;
  }

  return fallback;
}

function compareAircraftTypes(left: FleetpbAircraftType, right: FleetpbAircraftType): number {
  if (filters.sort === "price-asc") {
    return (left.price_per_unit ?? 0) - (right.price_per_unit ?? 0);
  }

  if (filters.sort === "range-desc") {
    return (right.max_range_km ?? 0) - (left.max_range_km ?? 0);
  }

  return (right.max_planned_seat_capacity ?? 0) - (left.max_planned_seat_capacity ?? 0);
}

function formatMoney(value: number | undefined): string {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value ?? 0);
}

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value ?? 0);
}

async function loadFleetData(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const [typesResponse, airportsResponse, aircraftsResponse] = await Promise.all([
      apiClient.get<FleetpbListAircraftTypesResponse>("/aircraft-types"),
      apiClient.get<OperationspbListAirportsResponse>("/airports"),
      apiClient.get<FleetpbListAircraftsResponse>("/aircrafts"),
    ]);

    aircraftTypes.value = typesResponse.items ?? [];
    airports.value = airportsResponse.airports ?? [];
    aircrafts.value = aircraftsResponse.items ?? [];
    selectedTypeId.value ||= availableAircraftTypes.value[0]?.id ?? "";
  } catch (loadError) {
    error.value = apiMessage(loadError, "Could not load fleet data.");
  } finally {
    isLoading.value = false;
  }
}

function matchesQuery(text: string, query: string): boolean {
  return !query || text.includes(query);
}

function meetsMaximum(value: number | undefined, maxValue: string): boolean {
  return (value ?? 0) <= (Number(maxValue) || Number.POSITIVE_INFINITY);
}

function meetsMinimum(value: number | undefined, minValue: string): boolean {
  return (value ?? 0) >= (Number(minValue) || 0);
}

function meetsRunway(minRunway: number | undefined): boolean {
  return (minRunway ?? 0) <= (selectedBaseAirport.value?.max_runway_length_m ?? Number.POSITIVE_INFINITY);
}

async function purchaseAircraft(): Promise<void> {
  if (!canPurchase.value) {
    return;
  }

  isPurchasing.value = true;
  error.value = "";
  message.value = "";

  try {
    const tailNumber = filters.tailNumber.trim().toUpperCase();
    const response = await apiClient.post<FleetpbCreateAircraftResponse>("/aircraft", {
      aircraft_type_id: selectedTypeId.value,
      base_airport_id: selectedBaseAirportId.value,
      tail_number: tailNumber,
    });

    message.value = `Aircraft purchased: ${response.id ?? tailNumber}`;
    // eslint-disable-next-line require-atomic-updates
    filters.tailNumber = "";
    await loadFleetData();
  } catch (purchaseError) {
    error.value = apiMessage(purchaseError, "Could not purchase aircraft.");
  } finally {
    isPurchasing.value = false;
  }
}

function toAirportOption(airport: OperationspbAirport): { label: string; value: string } {
  return {
    label: `${airport.iata_code || airport.icao_code || "----"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`,
    value: airport.id ?? "",
  };
}
</script>

<template>
  <section class="min-h-full overflow-x-hidden bg-background p-4 text-body text-text-primary sm:p-6">
    <div class="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <AirBadge
          label="Fleet & Ops"
          variant="primary-soft"
        />
        <h1 class="mt-4 text-h2">
          Aircraft Market
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Buy aircraft from backend catalog, filter by performance, and assign a base airport.
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="isLoading ? 'Loading' : 'Refresh'"
        size="sm"
        variant="primary-soft"
        @click="loadFleetData"
      />
    </div>

    <div
      v-if="error || message"
      class="mt-4 rounded-lg border p-3 text-body"
      :class="error ? 'border-error bg-error-bg text-slate-950' : 'border-success bg-success-bg text-slate-950'"
    >
      {{ error || message }}
    </div>

    <div class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div class="min-w-0">
        <div class="grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-5">
          <AirTextField
            v-model="filters.query"
            label="Search"
            placeholder="A320, B738, long range"
            type="search"
          />
          <AirTextField
            v-model="filters.minRange"
            label="Min range, km"
            placeholder="2500"
          />
          <AirTextField
            v-model="filters.minCapacity"
            label="Min seats"
            placeholder="120"
          />
          <AirTextField
            v-model="filters.maxPrice"
            label="Max price"
            placeholder="90000000"
          />
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-caption text-text-muted">Sort</span>
            <AirSelect
              v-model="filters.sort"
              class="w-full"
              label="Sort aircraft"
              :options="selectedTypeOptions"
            />
          </div>
        </div>

        <div class="mt-4 grid gap-3 lg:grid-cols-2">
          <button
            v-for="type in availableAircraftTypes"
            :key="type.id"
            class="min-w-0 rounded-lg border bg-surface p-4 text-left transition hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            :class="selectedTypeId === type.id ? 'border-primary' : 'border-border'"
            type="button"
            @click="selectedTypeId = type.id ?? ''"
          >
            <div class="flex min-w-0 items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-subtitle">
                  {{ type.model_name || "Aircraft type" }}
                </p>
                <p class="mt-1 text-caption text-text-muted">
                  {{ type.icao_code || "----" }} / {{ type.iata_code || "---" }}
                </p>
              </div>
              <AirBadge
                :label="formatMoney(type.price_per_unit)"
                variant="success-soft"
              />
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3 text-caption text-text-muted sm:grid-cols-4">
              <span>{{ formatNumber(type.max_planned_seat_capacity) }} seats</span>
              <span>{{ formatNumber(type.max_range_km) }} km</span>
              <span>{{ formatNumber(type.cruising_speed_kph) }} kph</span>
              <span>{{ formatNumber(type.min_runway_length_m) }} m runway</span>
            </div>
          </button>
        </div>

        <div
          v-if="!isLoading && availableAircraftTypes.length === 0"
          class="mt-4 rounded-lg border border-border bg-surface p-5 text-text-muted"
        >
          No aircraft types match the current filters.
        </div>
      </div>

      <aside class="min-w-0 rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          Purchase
        </h2>
        <p class="mt-2 text-body text-text-muted">
          {{ selectedTypeSummary }}
        </p>

        <div class="mt-4 grid gap-3">
          <AirTextField
            v-model="filters.airportQuery"
            label="Base airport filter"
            placeholder="ICN, Istanbul, Seoul"
            type="search"
          />
          <div class="flex min-w-0 flex-col gap-1.5">
            <span class="text-caption text-text-muted">Base airport</span>
            <AirSelect
              v-model="selectedBaseAirportId"
              class="w-full"
              label="Base airport"
              :options="baseAirportOptions"
            />
          </div>
          <AirTextField
            v-model="filters.tailNumber"
            label="Tail number"
            placeholder="HL-001"
          />
          <AirButton
            :disabled="!canPurchase"
            :label="isPurchasing ? 'Purchasing' : 'Buy aircraft'"
            class="w-full"
            @click="purchaseAircraft"
          />
        </div>

        <div class="mt-6 border-t border-border pt-4">
          <h2 class="text-subtitle">
            Owned Aircraft
          </h2>
          <div class="mt-3 grid gap-3">
            <div
              v-for="aircraft in ownedAircraftRows"
              :key="aircraft.id"
              class="rounded-lg border border-border bg-background p-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-subtitle">
                    {{ aircraft.tail_number || aircraft.id }}
                  </p>
                  <p class="mt-1 truncate text-caption text-text-muted">
                    {{ aircraft.modelName }}
                  </p>
                </div>
                <AirBadge
                  :label="aircraft.status || 'owned'"
                  variant="primary-soft"
                />
              </div>
              <p class="mt-2 truncate text-caption text-text-muted">
                {{ aircraft.baseAirportName }}
              </p>
            </div>
            <p
              v-if="!isLoading && ownedAircraftRows.length === 0"
              class="text-body text-text-muted"
            >
              No aircraft purchased yet.
            </p>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>
