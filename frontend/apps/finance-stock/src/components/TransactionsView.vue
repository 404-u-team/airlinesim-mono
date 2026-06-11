<script setup lang="ts">
import { AirMetricCard, AirPagination, AirStatePanel } from "@airlinesim/air-ui";
import { type Locale } from "@airlinesim/i18n";
import { onMounted, ref, watch } from "vue";

import type { FinanceMessageKey } from "../i18n";
import type { LedgerPage, LedgerTransaction } from "../types";

import { getFinanceTransactions } from "../api";

const props = defineProps<{
  appLocale: Locale;
  formatMoney: (value?: number, signed?: boolean) => string;
  t: (key: FinanceMessageKey) => string;
  transactionLabel: (code: string) => string;
}>();

const emit = defineEmits<{ error: [message: string] }>();

const PAGE_SIZE = 25;

const page = ref(1);
const includeCapex = ref(true);
const data = ref<LedgerPage | null>(null);
const isLoading = ref(false);

onMounted(() => {
  void load();
});

watch(includeCapex, () => {
  page.value = 1;
});

watch([page, includeCapex], () => {
  void load();
});

function formatOccurredAt(transaction: LedgerTransaction): string {
  return new Intl.DateTimeFormat(props.appLocale, { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(transaction.occurred_at));
}

async function load(): Promise<void> {
  isLoading.value = true;
  try {
    data.value = await getFinanceTransactions({
      includeCapex: includeCapex.value,
      page: page.value,
      pageSize: PAGE_SIZE,
    });
  } catch (loadError) {
    emit("error", loadError instanceof Error ? loadError.message : props.t("errorLoad"));
  } finally {
    isLoading.value = false;
  }
}

function transactionAmount(transaction: LedgerTransaction): number {
  return transaction.direction === "credit" ? transaction.amount : -transaction.amount;
}
</script>

<template>
  <div class="grid gap-4">
    <div class="grid gap-3 sm:grid-cols-3">
      <AirMetricCard
        :label="props.t('revenue')"
        tone="success"
        :value="props.formatMoney(data?.summary.revenue ?? 0)"
      />
      <AirMetricCard
        :label="props.t('costs')"
        tone="danger"
        :value="props.formatMoney(data?.summary.costs ?? 0)"
      />
      <AirMetricCard
        :label="props.t('profit')"
        :tone="(data?.summary.profit ?? 0) < 0 ? 'danger' : 'success'"
        :value="props.formatMoney(data?.summary.profit ?? 0, true)"
      />
    </div>

    <section class="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 class="text-subtitle">
          {{ props.t("transactionsTitle") }}
        </h2>
        <label class="flex cursor-pointer items-center gap-2 text-caption text-text-muted">
          <input
            v-model="includeCapex"
            class="accent-primary"
            type="checkbox"
          />
          <span>{{ props.t("includeCapex") }}</span>
        </label>
      </div>

      <div
        class="grid gap-2 p-4"
        :class="isLoading ? 'opacity-60' : ''"
      >
        <article
          v-for="transaction in data?.transactions ?? []"
          :key="transaction.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <strong class="truncate">{{ props.transactionLabel(transaction.label_code) }}</strong>
              <span
                v-if="transaction.excluded_from_balance"
                class="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted"
              >
                {{ props.t("capexTag") }}
              </span>
            </div>
            <span class="text-caption text-text-muted">
              {{ formatOccurredAt(transaction) }} · {{ transaction.category }}
            </span>
          </div>
          <strong :class="transaction.direction === 'credit' ? 'text-success' : 'text-error'">
            {{ props.formatMoney(transactionAmount(transaction), true) }}
          </strong>
        </article>
        <AirStatePanel
          v-if="!isLoading && (data?.transactions.length ?? 0) === 0"
          :title="props.t('empty')"
        />
      </div>

      <AirPagination
        v-if="(data?.total ?? 0) > PAGE_SIZE"
        :page="page"
        :page-size="PAGE_SIZE"
        :total-items="data?.total ?? 0"
        @update:page="page = $event"
      />
    </section>
  </div>
</template>
