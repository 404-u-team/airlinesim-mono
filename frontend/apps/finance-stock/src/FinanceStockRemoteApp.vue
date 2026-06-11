<script setup lang="ts">
import { AirButton, AirMetricCard, AirPagination, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { type Locale } from "@airlinesim/i18n";
import { computed, onMounted, ref, watch } from "vue";

import type { FinanceOverview, LedgerTransaction, RouteProfitability } from "./types";

import { getFinanceLedger, getFinanceOverview, getRouteProfitability } from "./api";
import BalanceChart from "./components/BalanceChart.vue";
import CashflowChart from "./components/CashflowChart.vue";
import ProfitTable, { type ProfitRow } from "./components/ProfitTable.vue";
import TransactionsView from "./components/TransactionsView.vue";
import { financeText } from "./i18n";

const props = defineProps<{ appLocale: Locale; shellPath?: string }>();

const LEDGER_PAGE_SIZE = 10;

const overview = ref<FinanceOverview | null>(null);
const ledger = ref<LedgerTransaction[]>([]);
const ledgerPage = ref(1);
const routes = ref<RouteProfitability[]>([]);
const error = ref("");
const isLoading = ref(false);
const view = computed(() => props.shellPath?.split("/")[2] ?? "overview");
const t = computed(() => (key: Parameters<typeof financeText>[1]) => financeText(props.appLocale, key));

const aircraftRows = computed<ProfitRow[]>(() =>
  [...(overview.value?.aircraft_profitability ?? [])]
    .map((item) => ({ costs: item.costs, flights: item.flights_completed, id: item.aircraft_id, label: item.aircraft_label, profit: item.profit, revenue: item.revenue }))
    .sort((left, right) => right.profit - left.profit),
);
const costCategories = computed(() => {
  const byCategory = new Map<string, number>();
  for (const transaction of ledger.value) {
    if (transaction.direction === "debit") {
      byCategory.set(transaction.label_code, (byCategory.get(transaction.label_code) ?? 0) + transaction.amount);
    }
  }
  const total = [...byCategory.values()].reduce((sum, value) => sum + value, 0);

  return [...byCategory.entries()]
    .map(([code, amount]) => ({ amount, code, percent: total > 0 ? Math.round((amount / total) * 100) : 0 }))
    .sort((left, right) => right.amount - left.amount);
});
const costLedger = computed(() => ledger.value.filter((transaction) => transaction.direction === "debit"));
const hubRows = computed<ProfitRow[]>(() =>
  [...(overview.value?.hub_profitability ?? [])]
    .map((hub) => ({ costs: hub.costs, flights: hub.flights_completed, id: hub.airport_id, label: hub.label, profit: hub.profit, revenue: hub.revenue }))
    .sort((left, right) => right.profit - left.profit),
);
const pagedCostLedger = computed(() =>
  costLedger.value.slice((ledgerPage.value - 1) * LEDGER_PAGE_SIZE, ledgerPage.value * LEDGER_PAGE_SIZE),
);
const routeRows = computed<ProfitRow[]>(() =>
  [...routes.value]
    .map((route) => ({ costs: route.costs, flights: route.flights_completed, id: route.route_id, label: routeLabel(route), profit: route.profit, revenue: route.revenue }))
    .sort((left, right) => right.profit - left.profit),
);

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "finance-stock" });
  void loadFinance();
});

watch(view, () => {
  ledgerPage.value = 1;
});

function formatMoney(value = 0, signed = false): string {
  return new Intl.NumberFormat(props.appLocale, {
    currency: "USD",
    maximumFractionDigits: 0,
    signDisplay: signed ? "exceptZero" : "auto",
    style: "currency",
  }).format(value);
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
  return `${route.origin_airport_label ?? route.origin_airport_id} → ${route.destination_airport_label ?? route.destination_airport_id}`;
}

function transactionAmount(transaction: LedgerTransaction): number {
  return transaction.direction === "credit" ? transaction.amount : -transaction.amount;
}

function transactionLabel(code: string): string {
  const keys = {
    FINANCE_AIRCRAFT_PURCHASE: "transactionAircraftPurchase",
    FINANCE_AIRPORT_FEES: "transactionAirportFees",
    FINANCE_FLIGHT_REVENUE: "transactionFlightRevenue",
    FINANCE_FUEL_COST: "transactionFuelCost",
    FINANCE_FUEL_PURCHASE: "transactionFuelPurchase",
    FINANCE_HUB_ESTABLISHMENT: "transactionHubEstablishment",
    FINANCE_MAINTENANCE_RESERVE: "transactionMaintenanceReserve",
    FINANCE_PRICE_ANALYSIS_FEE: "transactionPriceAnalysisFee",
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

      <!-- R&F profit: detailed route + aircraft profitability -->
      <div v-if="view === 'profit'" class="mt-5 grid gap-4">
        <ProfitTable
          :costs-header="t('costs')"
          :empty-text="t('empty')"
          :flights-header="t('flights')"
          :locale="props.appLocale"
          :name-header="t('routes')"
          :profit-header="t('profit')"
          :revenue-header="t('revenue')"
          :rows="routeRows"
          :title="t('routes')"
        />
        <ProfitTable
          :costs-header="t('costs')"
          :empty-text="t('empty')"
          :flights-header="t('flights')"
          :locale="props.appLocale"
          :name-header="t('aircraft')"
          :profit-header="t('profit')"
          :revenue-header="t('revenue')"
          :rows="aircraftRows"
          :title="t('aircraft')"
        />
        <ProfitTable
          :costs-header="t('costs')"
          :empty-text="t('empty')"
          :flights-header="t('flights')"
          :locale="props.appLocale"
          :name-header="t('hubs')"
          :profit-header="t('profit')"
          :revenue-header="t('revenue')"
          :rows="hubRows"
          :title="t('hubs')"
        />
      </div>

      <!-- Costs: category breakdown + debit ledger -->
      <div v-else-if="view === 'costs'" class="mt-5 grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <section class="rounded-lg border border-border bg-surface p-4">
          <h2 class="text-subtitle">
            {{ t("costByCategory") }}
          </h2>
          <div class="mt-4 grid gap-3">
            <div v-for="category in costCategories" :key="category.code">
              <div class="flex items-center justify-between gap-2 text-caption">
                <span class="truncate">{{ transactionLabel(category.code) }}</span>
                <strong>{{ formatMoney(category.amount) }}</strong>
              </div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-surface-subtle">
                <div class="h-full rounded-full bg-warning" :style="{ width: `${category.percent}%` }" />
              </div>
            </div>
            <AirStatePanel v-if="costCategories.length === 0" :title="t('empty')" />
          </div>
        </section>

        <section class="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
          <h2 class="border-b border-border px-4 py-3 text-subtitle">
            {{ t("costs") }}
          </h2>
          <div class="grid gap-2 p-4">
            <article v-for="transaction in pagedCostLedger" :key="transaction.id" class="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
              <div class="min-w-0">
                <strong class="block truncate">{{ transactionLabel(transaction.label_code) }}</strong>
                <span class="text-caption text-text-muted">{{ new Intl.DateTimeFormat(props.appLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(transaction.occurred_at)) }}</span>
              </div>
              <strong class="text-error">{{ formatMoney(transactionAmount(transaction), true) }}</strong>
            </article>
            <AirStatePanel v-if="costLedger.length === 0" :title="t('empty')" />
          </div>
          <AirPagination
            v-if="costLedger.length > LEDGER_PAGE_SIZE"
            :page="ledgerPage"
            :page-size="LEDGER_PAGE_SIZE"
            :total-items="costLedger.length"
            @update:page="ledgerPage = $event"
          />
        </section>
      </div>

      <!-- Transactions: full paginated ledger with capex toggle -->
      <TransactionsView
        v-else-if="view === 'transactions'"
        class="mt-5"
        :app-locale="props.appLocale"
        :format-money="formatMoney"
        :t="t"
        :transaction-label="transactionLabel"
        @error="error = $event"
      />

      <!-- Overview: charts + top-3 tables -->
      <template v-else>
        <div class="mt-5 grid gap-4 xl:grid-cols-2">
          <section class="min-w-0 rounded-lg border border-border bg-surface p-4">
            <h2 class="text-subtitle">
              {{ t("balanceChart") }}
            </h2>
            <p class="text-caption text-text-muted">
              {{ t("balanceChartHint") }}
            </p>
            <div class="mt-3">
              <BalanceChart
                v-if="ledger.length"
                :baseline="overview.balance.backend_baseline"
                :locale="props.appLocale"
                :transactions="ledger"
              />
              <p v-else class="py-16 text-center text-caption text-text-muted">
                {{ t("chartEmpty") }}
              </p>
            </div>
          </section>
          <section class="min-w-0 rounded-lg border border-border bg-surface p-4">
            <h2 class="text-subtitle">
              {{ t("chartCashflow") }}
            </h2>
            <p class="text-caption text-text-muted">
              {{ t("chartCashflowHint") }}
            </p>
            <div class="mt-3">
              <CashflowChart
                v-if="ledger.length"
                :costs-label="t('costs')"
                :locale="props.appLocale"
                :revenue-label="t('revenue')"
                :transactions="ledger"
              />
              <p v-else class="py-16 text-center text-caption text-text-muted">
                {{ t("chartEmpty") }}
              </p>
            </div>
          </section>
        </div>

        <div class="mt-4 grid gap-4 xl:grid-cols-2">
          <ProfitTable
            :costs-header="t('costs')"
            :empty-text="t('empty')"
            :flights-header="t('flights')"
            :locale="props.appLocale"
            :name-header="t('routes')"
            :profit-header="t('profit')"
            :revenue-header="t('revenue')"
            :rows="routeRows.slice(0, 3)"
            :title="t('topRoutes')"
          />
          <ProfitTable
            :costs-header="t('costs')"
            :empty-text="t('empty')"
            :flights-header="t('flights')"
            :locale="props.appLocale"
            :name-header="t('aircraft')"
            :profit-header="t('profit')"
            :revenue-header="t('revenue')"
            :rows="aircraftRows.slice(0, 3)"
            :title="t('topAircraft')"
          />
        </div>
      </template>
    </template>
  </section>
</template>
