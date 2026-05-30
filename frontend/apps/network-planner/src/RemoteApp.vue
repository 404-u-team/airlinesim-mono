<script setup lang="ts">
import { AirBadge, AirButton, AirMetricCard, AirSelect } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { ApiRequestError, createApiClient, createAuthClient } from "@airlinesim/game-sdk";
import { computed, onMounted, ref } from "vue";

type AirportOption = {
  id?: string;
  label: string;
};

type DemandResponse = {
  demand?: {
    destination_daily_passengers?: number;
    distance_km?: number;
    origin_daily_passengers?: number;
  };
};

type Metric = {
  label: string;
  tone?: "danger" | "neutral" | "success" | "warning";
  value: string;
};

type NetworkOpportunity = {
  airport?: {
    iata_code?: string;
    id?: string;
    intl_name?: string;
    max_runway_uses_per_day?: number;
  };
  demand?: number;
  region_name?: string;
  score?: number;
};

type NetworkResponse = {
  airports?: AirportOption[];
  opportunities?: NetworkOpportunity[];
  origin_airport?: {
    id?: string;
    intl_name?: string;
  };
};

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});
const data = ref<NetworkResponse>({});
const demand = ref<DemandResponse["demand"]>();
const error = ref("");
const isCalculating = ref(false);
const isLoading = ref(false);
const selectedDestinationId = ref("");
const selectedOriginId = ref("");

const airportOptions = computed(() => [
  { label: "Home airport", value: "" },
  ...(data.value.airports ?? []).map((airport) => ({
    label: airport.label,
    value: airport.id ?? "",
  })),
]);
const selectedDestination = computed(() =>
  data.value.opportunities?.find((opportunity) => opportunity.airport?.id === selectedDestinationId.value),
);
const topMetrics = computed<Metric[]>(() => [
  {
    label: "Opportunities",
    value: formatNumber(data.value.opportunities?.length),
  },
  {
    label: "Best demand",
    value: formatNumber(data.value.opportunities?.[0]?.demand),
  },
  {
    label: "Saved demand",
    tone: demand.value ? "success" : "neutral",
    value: demand.value ? formatNumber(demand.value.origin_daily_passengers) : "-",
  },
]);

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "network-planner" });
  void loadOpportunities();
});

function apiMessage(value: unknown): string {
  if (value instanceof ApiRequestError && value.status === 401) {
    return "Sign in to plan routes.";
  }

  return value instanceof Error ? value.message : "Could not load route opportunities.";
}

async function calculateDemand(destinationId: string | undefined): Promise<void> {
  const originId = data.value.origin_airport?.id;
  if (!originId || !destinationId) {
    return;
  }

  isCalculating.value = true;
  error.value = "";
  selectedDestinationId.value = destinationId;

  try {
    const response = await apiClient.get<DemandResponse>(
      `/demand/airport-pair?origin_airport_id=${encodeURIComponent(originId)}&destination_airport_id=${encodeURIComponent(destinationId)}`,
    );
    demand.value = response.demand;
  } catch (loadError) {
    error.value = apiMessage(loadError);
  } finally {
    isCalculating.value = false;
  }
}

function destinationTitle(opportunity: NetworkOpportunity): string {
  return `${opportunity.airport?.iata_code || "----"} - ${opportunity.airport?.intl_name ?? "Airport"}`;
}

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value ?? 0);
}

async function loadOpportunities(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  demand.value = undefined;

  try {
    const query = selectedOriginId.value ? `?origin_airport_id=${encodeURIComponent(selectedOriginId.value)}` : "";
    data.value = await apiClient.get<NetworkResponse>(`/game/network-opportunities${query}`);
    selectedDestinationId.value = data.value.opportunities?.[0]?.airport?.id ?? "";
  } catch (loadError) {
    error.value = apiMessage(loadError);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <section class="min-h-full overflow-x-hidden bg-background p-4 text-body text-text-primary sm:p-6">
    <div class="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <AirBadge
          label="Network Planner"
          variant="warning-soft"
        />
        <h1 class="mt-4 text-h2">
          Route Opportunities
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Rank destinations from backend region links and generate route demand on demand.
        </p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row">
        <AirSelect
          v-model="selectedOriginId"
          label="Origin airport"
          :options="airportOptions"
        />
        <AirButton
          :disabled="isLoading"
          :label="isLoading ? 'Loading' : 'Refresh'"
          size="sm"
          variant="warning"
          @click="loadOpportunities"
        />
      </div>
    </div>

    <div
      v-if="error"
      class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-slate-950"
    >
      {{ error }}
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-3">
      <AirMetricCard
        v-for="metric in topMetrics"
        :key="metric.label"
        :label="metric.label"
        :tone="metric.tone"
        :value="metric.value"
      />
    </div>

    <div class="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div class="grid gap-3 lg:grid-cols-2">
        <article
          v-for="opportunity in data.opportunities"
          :key="opportunity.airport?.id"
          class="rounded-lg border border-border bg-surface p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="truncate text-subtitle">
                {{ destinationTitle(opportunity) }}
              </h2>
              <p class="mt-1 truncate text-caption text-text-muted">
                {{ opportunity.region_name }}
              </p>
            </div>
            <AirBadge
              :label="formatNumber(opportunity.demand)"
              variant="warning-soft"
            />
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-caption text-text-muted">
            <span>Score {{ formatNumber(opportunity.score) }}</span>
            <span>Slots {{ formatNumber(opportunity.airport?.max_runway_uses_per_day) }}</span>
          </div>
          <AirButton
            class="mt-4 w-full"
            :disabled="isCalculating"
            label="Calculate demand"
            size="sm"
            variant="warning"
            @click="calculateDemand(opportunity.airport?.id)"
          />
        </article>
      </div>

      <aside class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          Demand Result
        </h2>
        <p class="mt-2 text-body text-text-muted">
          {{ selectedDestination ? destinationTitle(selectedDestination) : "Select a destination." }}
        </p>
        <div class="mt-4 grid gap-3">
          <AirMetricCard
            label="Outbound pax/day"
            :value="formatNumber(demand?.origin_daily_passengers)"
            :tone="demand ? 'success' : 'neutral'"
          />
          <AirMetricCard
            label="Inbound pax/day"
            :value="formatNumber(demand?.destination_daily_passengers)"
          />
          <AirMetricCard
            label="Distance"
            :value="`${formatNumber(demand?.distance_km)} km`"
          />
        </div>
      </aside>
    </div>
  </section>
</template>
