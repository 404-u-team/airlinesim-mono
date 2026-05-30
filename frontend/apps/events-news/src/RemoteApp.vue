<script setup lang="ts">
import { AirBadge, AirButton, AirMetricCard } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { ApiRequestError, createApiClient, createAuthClient } from "@airlinesim/game-sdk";
import { computed, onMounted, ref } from "vue";

type EventItem = {
  action?: string;
  message?: string;
  severity?: "danger" | "info" | "success" | "warning";
  title?: string;
};

type EventsResponse = {
  events?: EventItem[];
};

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});
const error = ref("");
const events = ref<EventItem[]>([]);
const isLoading = ref(false);

const counts = computed(() => ({
  danger: events.value.filter((event) => event.severity === "danger").length,
  success: events.value.filter((event) => event.severity === "success").length,
  total: events.value.length,
  warning: events.value.filter((event) => event.severity === "warning").length,
}));

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "events-news" });
  void loadEvents();
});

function apiMessage(value: unknown): string {
  if (value instanceof ApiRequestError && value.status === 401) {
    return "Sign in to view events.";
  }

  return value instanceof Error ? value.message : "Could not load event feed.";
}

function eventTone(event: EventItem): "danger" | "neutral" | "success" | "warning" {
  return event.severity === "info" || !event.severity ? "neutral" : event.severity;
}

function eventVariant(event: EventItem): "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" {
  const tone = eventTone(event);

  if (tone === "neutral") {
    return "primary-soft";
  }

  return `${tone}-soft`;
}

async function loadEvents(): Promise<void> {
  isLoading.value = true;
  error.value = "";

  try {
    const response = await apiClient.get<EventsResponse>("/game/events-feed");
    events.value = response.events ?? [];
  } catch (loadError) {
    error.value = apiMessage(loadError);
  } finally {
    isLoading.value = false;
  }
}

function notify(event: EventItem): void {
  airlineSimEventBus.emit("notification:created", {
    message: event.message ?? event.title ?? "Event",
    severity: event.severity === "danger" ? "error" : event.severity ?? "info",
  });
}
</script>

<template>
  <section class="min-h-full overflow-x-hidden bg-background p-4 text-body text-text-primary sm:p-6">
    <div class="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <AirBadge
          label="Events & News"
          variant="danger-soft"
        />
        <h1 class="mt-4 text-h2">
          Operations Feed
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Generated alerts from backend airline, fleet and region-link state.
        </p>
      </div>
      <AirButton
        :disabled="isLoading"
        :label="isLoading ? 'Loading' : 'Refresh'"
        size="sm"
        variant="danger"
        @click="loadEvents"
      />
    </div>

    <div
      v-if="error"
      class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-slate-950"
    >
      {{ error }}
    </div>

    <div class="mt-6 grid gap-3 sm:grid-cols-4">
      <AirMetricCard
        label="Total"
        :value="String(counts.total)"
      />
      <AirMetricCard
        label="Healthy"
        tone="success"
        :value="String(counts.success)"
      />
      <AirMetricCard
        label="Warnings"
        tone="warning"
        :value="String(counts.warning)"
      />
      <AirMetricCard
        label="Critical"
        tone="danger"
        :value="String(counts.danger)"
      />
    </div>

    <div class="mt-5 grid gap-3 lg:grid-cols-2">
      <article
        v-for="event in events"
        :key="`${event.title}-${event.message}`"
        class="rounded-lg border border-border bg-surface p-4"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-subtitle">
              {{ event.title }}
            </h2>
            <p class="mt-2 text-body text-text-muted">
              {{ event.message }}
            </p>
          </div>
          <AirBadge
            :label="event.severity ?? 'info'"
            :variant="eventVariant(event)"
          />
        </div>
        <AirButton
          class="mt-4"
          :label="event.action ?? 'Notify'"
          size="sm"
          variant="primary-soft"
          @click="notify(event)"
        />
      </article>
    </div>
  </section>
</template>
