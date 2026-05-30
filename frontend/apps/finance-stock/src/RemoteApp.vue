<script setup lang="ts">
import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { ApiRequestError, createApiClient, createAuthClient } from "@airlinesim/game-sdk";
import { computed, onMounted, ref } from "vue";

type FinanceOverview = {
  airline?: {
    balance?: number;
    credit_rating?: number;
    is_bankrupt?: boolean;
    name?: string;
    reputation?: number;
    safety_rating?: number;
  };
  metrics?: {
    average_maintenance_ratio?: number;
    balance?: number;
    credit_rating?: number;
    daily_maintenance_reserve?: number;
    fleet_value?: number;
    owned_aircraft?: number;
  };
};

type Metric = {
  hint?: string;
  label: string;
  tone?: "danger" | "neutral" | "success" | "warning";
  value: string;
};

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});
const overview = ref<FinanceOverview>({});
const error = ref("");
const isLoading = ref(false);

const runway = computed<Metric[]>(() => [
  {
    label: "Balance",
    tone: (overview.value.metrics?.balance ?? 0) < 5_000_000 ? "warning" : "success",
    value: formatMoney(overview.value.metrics?.balance),
  },
  {
    label: "Fleet value",
    value: formatMoney(overview.value.metrics?.fleet_value),
  },
  {
    hint: "Estimated maintenance reserve for active utilization.",
    label: "Daily reserve",
    value: formatMoney(overview.value.metrics?.daily_maintenance_reserve),
  },
  {
    label: "Aircraft owned",
    value: formatNumber(overview.value.metrics?.owned_aircraft),
  },
]);

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "finance-stock" });
  void loadFinance();
});

function apiMessage(value: unknown): string {
  if (value instanceof ApiRequestError && value.status === 401) {
    return "Sign in to view finances.";
  }

  return value instanceof Error ? value.message : "Could not load finance overview.";
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

function formatPercent(value: number | undefined): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value ?? 0);
}

async function loadFinance(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    overview.value = await apiClient.get<FinanceOverview>("/game/finance-overview");
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
          label="Finance & Stock"
          variant="success-soft"
        />
        <h1 class="mt-4 text-h2">
          Finance Overview
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Airline cash position, fleet capital and maintenance reserve based on backend fleet data.
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="isLoading ? 'Loading' : 'Refresh'"
        size="sm"
        variant="success"
        @click="loadFinance"
      />
    </div>

    <div
      v-if="error"
      class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-slate-950"
    >
      {{ error }}
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <AirMetricCard
        v-for="metric in runway"
        :key="metric.label"
        :hint="metric.hint"
        :label="metric.label"
        :tone="metric.tone"
        :value="metric.value"
      />
    </div>

    <div class="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          Capital Health
        </h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <AirMetricCard
            label="Credit rating"
            :value="formatNumber(overview.metrics?.credit_rating)"
          />
          <AirMetricCard
            label="Reputation"
            :value="formatNumber(overview.airline?.reputation)"
          />
          <AirMetricCard
            label="Safety"
            :value="formatNumber(overview.airline?.safety_rating)"
          />
        </div>
      </div>

      <aside class="rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          Risk Signals
        </h2>
        <dl class="mt-4 grid gap-3">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-muted">
              Bankrupt flag
            </dt>
            <dd>{{ overview.airline?.is_bankrupt ? "Yes" : "No" }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-muted">
              Maintenance cover
            </dt>
            <dd>{{ formatPercent(overview.metrics?.average_maintenance_ratio) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-text-muted">
              Airline
            </dt>
            <dd class="truncate">
              {{ overview.airline?.name ?? "-" }}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>
</template>
