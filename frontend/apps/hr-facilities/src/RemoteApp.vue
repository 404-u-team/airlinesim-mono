<script setup lang="ts">
import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { ApiRequestError, createApiClient, createAuthClient } from "@airlinesim/game-sdk";
import { computed, onMounted, ref } from "vue";

type FacilitiesOverview = {
  base_airport?: {
    iata_code?: string;
    intl_name?: string;
    max_runway_length_m?: number;
  };
  metrics?: {
    based_aircraft?: number;
    compatible_types?: number;
    daily_slot_capacity?: number;
    night_operations?: boolean;
  };
  operating_costs?: {
    gate_fee?: number;
    stand_fee?: number;
    turnaround_point_price?: number;
  };
  title?: string;
};

type Metric = {
  label: string;
  tone?: "danger" | "neutral" | "success" | "warning";
  value: string;
};

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});
const error = ref("");
const isLoading = ref(false);
const overview = ref<FacilitiesOverview>({});

const metrics = computed<Metric[]>(() => [
  {
    label: "Based aircraft",
    value: formatNumber(overview.value.metrics?.based_aircraft),
  },
  {
    label: "Compatible types",
    value: formatNumber(overview.value.metrics?.compatible_types),
  },
  {
    label: "Daily slots",
    value: formatNumber(overview.value.metrics?.daily_slot_capacity),
  },
  {
    label: "Night ops",
    tone: overview.value.metrics?.night_operations ? "success" : "warning",
    value: overview.value.metrics?.night_operations ? "Enabled" : "Limited",
  },
]);

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "hr-facilities" });
  void loadFacilities();
});

function apiMessage(value: unknown): string {
  if (value instanceof ApiRequestError && value.status === 401) {
    return "Sign in to view facilities.";
  }

  return value instanceof Error ? value.message : "Could not load facilities.";
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

async function loadFacilities(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    overview.value = await apiClient.get<FacilitiesOverview>("/game/facilities-overview");
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
          label="HR & Facilities"
          variant="primary-soft"
        />
        <h1 class="mt-4 text-h2">
          Base Facilities
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Starting airport capacity, fleet compatibility and ground cost profile.
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="isLoading ? 'Loading' : 'Refresh'"
        size="sm"
        @click="loadFacilities"
      />
    </div>

    <div
      v-if="error"
      class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-slate-950"
    >
      {{ error }}
    </div>

    <div class="mt-6 rounded-lg border border-border bg-surface p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <h2 class="truncate text-h3">
            {{ overview.title ?? "No base airport" }}
          </h2>
          <p class="mt-1 text-body text-text-muted">
            Runway {{ formatNumber(overview.base_airport?.max_runway_length_m) }} m
          </p>
        </div>
        <AirBadge
          :label="overview.base_airport?.iata_code ?? 'BASE'"
          size="lg"
        />
      </div>
    </div>

    <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AirMetricCard
        v-for="metric in metrics"
        :key="metric.label"
        :label="metric.label"
        :tone="metric.tone"
        :value="metric.value"
      />
    </div>

    <div class="mt-5 rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        Ground Cost Profile
      </h2>
      <div class="mt-4 grid gap-3 sm:grid-cols-3">
        <AirMetricCard
          label="Gate fee"
          :value="formatMoney(overview.operating_costs?.gate_fee)"
        />
        <AirMetricCard
          label="Stand fee"
          :value="formatMoney(overview.operating_costs?.stand_fee)"
        />
        <AirMetricCard
          label="Turnaround points"
          :value="formatMoney(overview.operating_costs?.turnaround_point_price)"
        />
      </div>
    </div>
  </section>
</template>
