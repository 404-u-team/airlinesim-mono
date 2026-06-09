<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirCombobox, type AirComboboxOption, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { onBeforeUnmount, onMounted, ref } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type { AirportSearchOption, HubItem } from "../types";

import { addHub, getHubs, removeHub, searchAirports } from "../api";

const props = defineProps<{
  appLocale: Locale;
  t: (key: NetworkMessageKey) => string;
}>();

const hubs = ref<HubItem[]>([]);
const error = ref("");
const message = ref("");
const isLoading = ref(false);
const isMutating = ref(false);
const selectedAirportId = ref("");
const airportOptions = ref<AirComboboxOption[]>([]);

let searchTimer: null | ReturnType<typeof setTimeout> = null;

onMounted(() => {
  void load();
  void runSearch("");
});

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

function formatMoney(value: number): string {
  return new Intl.NumberFormat(props.appLocale, { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function invalidate(): void {
  airlineSimEventBus.emit("game:snapshot-invalidated", { reason: "manual-refresh", source: "network-planner" });
  airlineSimEventBus.emit("events:invalidated", { reason: "route-created", source: "network-planner" });
  airlineSimEventBus.emit("notifications:invalidated", { reason: "route-created", source: "network-planner" });
}

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    hubs.value = (await getHubs()).hubs;
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.load");
  } finally {
    isLoading.value = false;
  }
}

async function onAdd(): Promise<void> {
  const airportId = selectedAirportId.value;
  if (!airportId) {
    return;
  }
  isMutating.value = true;
  error.value = "";
  message.value = "";
  selectedAirportId.value = "";
  try {
    const response = await addHub(airportId);
    message.value = `${props.t("hubs.add")} · ${formatMoney(response.fee)}`;
    invalidate();
    await load();
  } catch (addError) {
    error.value = addError instanceof Error ? addError.message : props.t("error.load");
  } finally {
    isMutating.value = false;
  }
}

async function onRemove(hub: HubItem): Promise<void> {
  if (hub.is_base) {
    return;
  }
  isMutating.value = true;
  error.value = "";
  try {
    await removeHub(hub.airport_id);
    invalidate();
    await load();
  } catch (removeError) {
    error.value = removeError instanceof Error ? removeError.message : props.t("error.load");
  } finally {
    isMutating.value = false;
  }
}

function onSearch(query: string): void {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => void runSearch(query), 300);
}

async function runSearch(query: string): Promise<void> {
  try {
    const airports = await searchAirports(query);
    airportOptions.value = airports.map((airport: AirportSearchOption) => ({
      label: `${airport.iata_code ?? airport.icao_code ?? "---"} - ${airport.intl_name ?? airport.local_name ?? "Airport"}`,
      value: airport.id,
    }));
  } catch {
    error.value = props.t("hubs.searchError");
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4">
    <div class="border-b border-border pb-3">
      <h1 class="text-h2">
        {{ props.t("hubs.title") }}
      </h1>
      <p class="mt-1 max-w-3xl text-body text-text-muted">
        {{ props.t("hubs.subtitle") }}
      </p>
    </div>

    <AirStatePanel
      v-if="error"
      :body="error"
      :title="props.t('error.load')"
      tone="danger"
    />
    <AirStatePanel
      v-else-if="message"
      :title="message"
      tone="success"
    />

    <section class="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <AirCombobox
        :empty-text="props.t('hubs.searchPlaceholder')"
        :label="props.t('hubs.add')"
        :model-value="selectedAirportId"
        :options="airportOptions"
        :placeholder="props.t('hubs.searchPlaceholder')"
        @search="onSearch"
        @update:model-value="selectedAirportId = $event"
      />
      <AirButton
        :disabled="!selectedAirportId || isMutating"
        :label="props.t('hubs.add')"
        @click="onAdd"
      />
    </section>
    <p class="-mt-2 text-caption text-text-muted">
      {{ props.t("hubs.addHint") }}
    </p>

    <div class="overflow-x-auto rounded-lg border border-border bg-surface">
      <table class="w-full min-w-[36rem] border-collapse text-caption">
        <thead>
          <tr class="border-b border-border bg-surface-subtle text-left text-text-muted">
            <th class="px-4 py-2 font-medium">
              {{ props.t("hubs.title") }}
            </th>
            <th class="px-3 py-2 text-right font-medium">
              {{ props.t("hubs.routes") }}
            </th>
            <th class="px-3 py-2 text-right font-medium">
              {{ props.t("hubs.profit") }}
            </th>
            <th class="px-3 py-2 text-right font-medium">
              {{ props.t("hubs.fee") }}
            </th>
            <th class="px-4 py-2 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="hub in hubs"
            :key="hub.airport_id"
            class="border-b border-border last:border-b-0"
          >
            <td class="px-4 py-2.5">
              <span>{{ hub.label }}</span>
              <span
                v-if="hub.is_base"
                class="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] text-on-primary-soft"
              >{{ props.t("hubs.base") }}</span>
            </td>
            <td class="px-3 py-2.5 text-right text-text-muted">
              {{ hub.routes }}
            </td>
            <td
              class="px-3 py-2.5 text-right font-semibold"
              :class="hub.profit < 0 ? 'text-error' : 'text-success'"
            >
              {{ formatMoney(hub.profit) }}
            </td>
            <td class="px-3 py-2.5 text-right text-text-muted">
              {{ hub.fee > 0 ? formatMoney(hub.fee) : "—" }}
            </td>
            <td class="px-4 py-2.5 text-right">
              <AirButton
                v-if="!hub.is_base"
                :disabled="isMutating"
                :label="props.t('hubs.remove')"
                size="sm"
                variant="danger-soft"
                @click="onRemove(hub)"
              />
            </td>
          </tr>
          <tr v-if="!isLoading && hubs.length <= 1">
            <td
              class="px-4 py-8 text-center text-text-muted"
              colspan="5"
            >
              {{ props.t("hubs.empty") }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
