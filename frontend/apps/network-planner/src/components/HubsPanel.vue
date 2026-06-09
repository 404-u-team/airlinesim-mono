<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirStatePanel } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { onMounted, ref } from "vue";

import type { NetworkMessageKey } from "../i18n";
import type { HubItem } from "../types";

import { getHubs, removeHub } from "../api";
import EstablishHubPanel from "./EstablishHubPanel.vue";

const props = defineProps<{
  appLocale: Locale;
  t: (key: NetworkMessageKey) => string;
}>();

const hubs = ref<HubItem[]>([]);
const error = ref("");
const message = ref("");
const isLoading = ref(false);
const isMutating = ref(false);

onMounted(() => {
  void load();
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

function onHubError(msg: string): void {
  error.value = msg;
}

async function onHubEstablished(fee: number): Promise<void> {
  isMutating.value = true;
  error.value = "";
  message.value = `${props.t("hubs.add")} · ${formatMoney(fee)}`;
  try {
    invalidate();
    await load();
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : props.t("error.load");
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
  message.value = "";
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
</script>

<template>
  <div class="flex min-h-full flex-col gap-6">
    <!-- Header -->
    <div class="border-b border-border pb-4">
      <h1 class="text-h2 font-bold tracking-tight">
        {{ props.t("hubs.title") }}
      </h1>
      <p class="mt-1 max-w-3xl text-body text-text-muted">
        {{ props.t("hubs.subtitle") }}
      </p>
    </div>

    <!-- Feedback messages -->
    <AirStatePanel
      v-if="error"
      :body="error"
      :title="props.t('error.load')"
      tone="danger"
      class="animate-fade-in"
    />
    <AirStatePanel
      v-else-if="message"
      :title="message"
      tone="success"
      class="animate-fade-in"
    />

    <!-- Main Layout -->
    <div class="grid gap-6 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px] items-start">
      <!-- Left Column: Active Hubs List -->
      <div class="flex flex-col gap-4">
        <!-- Loading Active Hubs -->
        <div v-if="isLoading" class="flex flex-col gap-4 py-8 items-center justify-center text-text-muted">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <span class="text-caption mt-2">Loading hubs...</span>
        </div>

        <div v-else-if="hubs.length === 0" class="rounded-xl border border-dashed border-border p-8 text-center text-text-muted bg-surface-subtle">
          <p class="text-body font-medium">
            {{ props.t("hubs.empty") }}
          </p>
        </div>

        <!-- Hub Cards Grid -->
        <div v-else class="grid gap-4 sm:grid-cols-2">
          <div
            v-for="hub in hubs"
            :key="hub.airport_id"
            class="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:border-primary-soft hover:shadow-md"
            :class="{ 'border-l-4 border-l-primary': hub.is_base, 'border-l-4 border-l-text-muted': !hub.is_base }"
          >
            <!-- Card Header -->
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-h3 font-bold tracking-tight text-text">{{ hub.label.split(' - ')[0] }}</span>
                  <AirBadge
                    v-if="hub.is_base"
                    :label="props.t('hubs.base')"
                    variant="primary-soft"
                    size="sm"
                  />
                </div>
                <p class="text-caption text-text-muted mt-0.5 line-clamp-1">
                  {{ hub.label.split(' - ')[1] || 'Airport' }}
                </p>
              </div>

              <!-- Delete Action -->
              <AirButton
                v-if="!hub.is_base"
                :disabled="isMutating"
                :label="props.t('hubs.remove')"
                size="sm"
                variant="danger-soft"
                class="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
                @click="onRemove(hub)"
              />
            </div>

            <!-- Card Body / Stats -->
            <div class="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-4 text-caption">
              <!-- Routes Count -->
              <div class="flex flex-col">
                <span class="text-text-muted font-medium uppercase tracking-wider text-[10px]">{{ props.t("hubs.routes") }}</span>
                <span class="text-body font-bold text-text mt-0.5">{{ hub.routes }}</span>
              </div>
              
              <!-- Profit -->
              <div class="flex flex-col">
                <span class="text-text-muted font-medium uppercase tracking-wider text-[10px]">{{ props.t("hubs.profit") }}</span>
                <span 
                  class="text-body font-bold mt-0.5"
                  :class="hub.profit < 0 ? 'text-error' : 'text-success'"
                >
                  {{ formatMoney(hub.profit) }}
                </span>
              </div>
            </div>

            <!-- Fee information at the bottom -->
            <div v-if="hub.fee > 0" class="mt-3 text-[11px] text-text-muted flex justify-between items-center bg-surface-subtle -mx-5 -mb-5 px-5 py-2 border-t border-border">
              <span>{{ props.t("hubs.fee") }}</span>
              <span class="font-medium text-text">{{ formatMoney(hub.fee) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Establish Hub Panel Component -->
      <EstablishHubPanel
        :app-locale="props.appLocale"
        :is-mutating="isMutating"
        :t="props.t"
        @established="onHubEstablished"
        @error="onHubError"
      />
    </div>
  </div>
</template>
