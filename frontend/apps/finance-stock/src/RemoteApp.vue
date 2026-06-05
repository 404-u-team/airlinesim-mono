<script setup lang="ts">
import { AirButton, AirMetricCard, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { type Locale } from "@airlinesim/i18n";
import { computed, onMounted, ref } from "vue";

import type { FinanceOverview, LedgerTransaction, RouteProfitability } from "./types";

import { getFinanceLedger, getFinanceOverview, getRouteProfitability } from "./api";
import { financeText } from "./i18n";

const props = defineProps<{ appLocale: Locale; shellPath?: string }>();
const overview = ref<FinanceOverview | null>(null);
const ledger = ref<LedgerTransaction[]>([]);
const routes = ref<RouteProfitability[]>([]);
const error = ref("");
const isLoading = ref(false);
const view = computed(() => props.shellPath?.split("/")[2] ?? "overview");
const t = computed(() => (key: Parameters<typeof financeText>[1]) => financeText(props.appLocale, key));

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "finance-stock" });
  void loadFinance();
});

function formatMoney(value = 0, signed = false): string {
  const formatted = new Intl.NumberFormat(props.appLocale, {
    currency: "USD",
    maximumFractionDigits: 0,
    signDisplay: signed ? "exceptZero" : "auto",
    style: "currency",
  }).format(value);
  return formatted;
}

async function loadFinance(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    const [overviewResponse, ledgerResponse, routesResponse] = await Promise.all([
      getFinanceOverview(),
      getFinanceLedger(),
      getRouteProfitability(),
    ]);
    overview.value = overviewResponse;
    ledger.value = ledgerResponse.transactions;
    routes.value = routesResponse.routes;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : t.value("errorLoad");
  } finally {
    isLoading.value = false;
  }
}

function openTarget(path: string): void {
  airlineSimEventBus.emit("navigation:intent", { source: "mfe", targetPath: path });
}

function riskLabel(code: FinanceOverview["risks"][number]["code"]): string {
  const keys = {
    BANKRUPTCY_FLAG: "riskBankruptcy",
    LOW_BALANCE: "riskLowBalance",
    ROUTE_LOSS: "riskRouteLoss",
    WEEKLY_OPERATING_LOSS: "riskWeeklyLoss",
  } as const;
  return t.value(keys[code]);
}

function routeLabel(route: RouteProfitability): string {
  return `${route.origin_airport_label ?? route.origin_airport_id} -> ${route.destination_airport_label ?? route.destination_airport_id}`;
}

function transactionAmount(transaction: LedgerTransaction): number {
  return transaction.direction === "credit" ? transaction.amount : -transaction.amount;
}

function transactionLabel(code: string): string {
  const keys = {
    FINANCE_AIRPORT_FEES: "transactionAirportFees",
    FINANCE_FLIGHT_REVENUE: "transactionFlightRevenue",
    FINANCE_FUEL_COST: "transactionFuelCost",
    FINANCE_MAINTENANCE_RESERVE: "transactionMaintenanceReserve",
    FINANCE_SYSTEM_ADJUSTMENT: "transactionSystemAdjustment",
  } as const;
  return code in keys ? t.value(keys[code as keyof typeof keys]) : code.replaceAll("_", " ");
}
</script>

<template>
  <section class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <header class="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-h2">
          {{ t("overview") }}
        </h1>
        <p class="mt-2 max-w-3xl text-text-muted">
          {{ t("subtitle") }}
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="isLoading ? t('loading') : t('refresh')"
        size="sm"
        variant="success"
        @click="loadFinance"
      />
    </header>

    <AirStatePanel
      v-if="error"
      class="mt-4"
      :title="t('errorLoad')"
      :body="error"
      tone="danger"
    />

    <div v-if="view === 'stock-market'" class="mt-6 rounded-lg border border-border bg-surface p-6">
      <h2 class="text-h3">
        {{ t("stockTitle") }}
      </h2>
      <p class="mt-2 text-text-muted">
        {{ t("stockDisabled") }}
      </p>
    </div>

    <template v-else-if="overview">
      <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AirMetricCard :label="t('available')" tone="success" :value="formatMoney(overview.balance.available)" />
        <AirMetricCard :label="t('operationsDelta')" :tone="overview.balance.operations_delta < 0 ? 'danger' : 'success'" :value="formatMoney(overview.balance.operations_delta, true)" />
        <AirMetricCard :label="t('fleetValue')" :value="formatMoney(overview.metrics.fleet_value)" />
        <AirMetricCard :label="t('completed')" :value="String(overview.metrics.completed_flights)" />
      </div>

      <div v-if="overview.risks.length" class="mt-5 grid gap-3 md:grid-cols-2">
        <button
          v-for="risk in overview.risks"
          :key="risk.code"
          class="rounded-lg border border-warning bg-warning-bg p-4 text-left text-warning"
          type="button"
          @click="openTarget(risk.target_path)"
        >
          <strong>{{ riskLabel(risk.code) }}</strong>
          <span v-if="risk.value != null" class="mt-1 block">{{ formatMoney(risk.value, true) }}</span>
        </button>
      </div>

      <div v-if="view === 'profit'" class="mt-5 rounded-lg border border-border bg-surface p-4">
        <h2 class="text-subtitle">
          {{ t("routes") }}
        </h2>
        <div class="mt-4 grid gap-3">
          <article v-for="route in routes" :key="route.route_id" class="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-5">
            <strong>{{ routeLabel(route) }}</strong>
            <span>{{ t("completed") }}: {{ route.flights_completed }}</span>
            <span>{{ t("revenue") }}: {{ formatMoney(route.revenue) }}</span>
            <span>{{ t("costs") }}: {{ formatMoney(route.costs) }}</span>
            <span :class="route.profit < 0 ? 'text-error' : 'text-success'">{{ t("profit") }}: {{ formatMoney(route.profit, true) }}</span>
          </article>
          <AirStatePanel
            v-if="routes.length === 0"
            :title="t('empty')"
          />
        </div>
      </div>

      <div v-else class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ view === "costs" ? t("costs") : t("recent") }}
          </h2>
          <div class="mt-4 grid gap-2">
            <article v-for="transaction in ledger" :key="transaction.id" class="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
              <div class="min-w-0">
                <strong class="block truncate">{{ transactionLabel(transaction.label_code) }}</strong>
                <span class="text-caption text-text-muted">{{ new Intl.DateTimeFormat(props.appLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(transaction.occurred_at)) }}</span>
              </div>
              <strong :class="transaction.direction === 'credit' ? 'text-success' : 'text-error'">{{ formatMoney(transactionAmount(transaction), true) }}</strong>
            </article>
            <AirStatePanel
              v-if="ledger.length === 0"
              :title="t('empty')"
            />
          </div>
        </section>

        <aside class="grid gap-3">
          <AirMetricCard :label="`${t('revenue')} · ${t('weekly')}`" tone="success" :value="formatMoney(overview.metrics.weekly.revenue)" />
          <AirMetricCard :label="`${t('costs')} · ${t('weekly')}`" tone="warning" :value="formatMoney(overview.metrics.weekly.costs)" />
          <AirMetricCard :label="`${t('profit')} · ${t('weekly')}`" :tone="overview.metrics.weekly.profit < 0 ? 'danger' : 'success'" :value="formatMoney(overview.metrics.weekly.profit, true)" />
          <AirMetricCard :label="t('baseline')" :value="formatMoney(overview.balance.backend_baseline)" />
        </aside>
      </div>
    </template>
  </section>
</template>
