<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton, AirMetricCard, AirSelect } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";

import type { EventItem, EventsResponse, NotificationItem } from "./types";

import { getEvents, getNotifications, markAllRead, markRead } from "./api";
import { type EventMessageKey, t } from "./i18n";

const props = withDefaults(defineProps<{
  appLocale?: Locale;
  remoteId?: string;
  shellPath?: string;
}>(), {
  appLocale: "en",
  remoteId: "events-news",
  shellPath: "/events/feed",
});
const error = ref("");
const events = ref<EventsResponse | null>(null);
const filters = reactive({ category: "", severity: "" });
const isLoading = ref(false);
const notificationState = ref<"active" | "resolved">("active");
const notifications = ref<NotificationItem[]>([]);
let unsubscribeEvents: (() => void) | null = null;
let unsubscribeNotifications: (() => void) | null = null;
const isNotificationsView = computed(() => props.shellPath.includes("/notifications"));
const message = computed(() => (key: EventMessageKey): string => t(props.appLocale, key));
const categoryOptions = computed(() => ["", "fleet", "route", "operations", "finance", "system"].map((value) => ({
  label: message.value(`category.${value || "all"}` as EventMessageKey),
  value,
})));
const severityOptions = computed(() => ["", "info", "success", "warning", "danger"].map((value) => ({
  label: message.value(`severity.${value || "all"}` as EventMessageKey),
  value,
})));

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "events-news" });
  unsubscribeEvents = airlineSimEventBus.on("events:invalidated", () => void load());
  unsubscribeNotifications = airlineSimEventBus.on("notifications:invalidated", () => void load());
  void load();
});
onUnmounted(() => {
  unsubscribeEvents?.();
  unsubscribeNotifications?.();
});
watch(() => props.shellPath, () => void load());
watch(notificationState, () => {
  if (isNotificationsView.value) {
    void load();
  }
});

function date(value: string): string {
  return new Intl.DateTimeFormat(props.appLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function details(parameters: Record<string, boolean | number | string>): string {
  return Object.values(parameters).slice(0, 4).map((value) =>
    typeof value === "number" ? new Intl.NumberFormat(props.appLocale, { maximumFractionDigits: 2 }).format(value) : String(value),
  ).join(" · ");
}

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    if (isNotificationsView.value) {
      notifications.value = await getNotifications(notificationState.value);
    } else {
      events.value = await getEvents(filters);
    }
  } catch {
    error.value = props.appLocale === "ru" ? "Не удалось загрузить данные." : "Could not load data.";
  } finally {
    isLoading.value = false;
  }
}

function navigate(targetPath: string): void {
  airlineSimEventBus.emit("navigation:intent", { source: "mfe", targetPath });
}

async function openNotification(notification: NotificationItem): Promise<void> {
  if (!notification.is_read) {
    await markRead(notification.id);
    airlineSimEventBus.emit("notifications:invalidated", { reason: "read-state-changed", source: "events-news" });
  }
  navigate(notification.target_path);
}

async function readAll(): Promise<void> {
  await markAllRead();
  airlineSimEventBus.emit("notifications:invalidated", { reason: "read-state-changed", source: "events-news" });
  await load();
}

function tone(severity: EventItem["severity"]): "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" {
  return severity === "info" ? "primary-soft" : `${severity}-soft`;
}
</script>

<template>
  <section class="h-full overflow-y-auto overflow-x-hidden bg-background p-4 text-body text-text-primary sm:p-6">
    <header class="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <AirBadge :label="isNotificationsView ? message('tab.notifications') : message('tab.feed')" variant="primary-soft" />
        <h1 class="mt-4 text-h2">
          {{ message("title") }}
        </h1>
        <p class="mt-2 max-w-3xl text-text-muted">
          {{ message("description") }}
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AirButton
          :label="message('tab.feed')"
          size="sm"
          variant="primary-soft"
          @click="navigate('/events/feed')"
        />
        <AirButton
          :label="message('tab.notifications')"
          size="sm"
          variant="primary-soft"
          @click="navigate('/events/notifications')"
        />
        <AirButton
          :disabled="isLoading"
          :label="message('action.refresh')"
          size="sm"
          @click="load"
        />
      </div>
    </header>

    <div v-if="error" class="mt-4 rounded-lg border border-error bg-error-bg p-3 text-error">
      {{ error }}
    </div>

    <template v-if="!isNotificationsView">
      <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AirMetricCard :label="message('category.fleet')" :value="String(events?.counts.categories.fleet ?? 0)" />
        <AirMetricCard :label="message('category.route')" :value="String(events?.counts.categories.route ?? 0)" />
        <AirMetricCard :label="message('category.operations')" :value="String(events?.counts.categories.operations ?? 0)" />
        <AirMetricCard :label="message('category.finance')" :value="String(events?.counts.categories.finance ?? 0)" />
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <AirSelect
          v-model="filters.category"
          :label="message('category.all')"
          :options="categoryOptions"
          @update:model-value="load"
        />
        <AirSelect
          v-model="filters.severity"
          :label="message('severity.all')"
          :options="severityOptions"
          @update:model-value="load"
        />
      </div>
      <div v-if="!isLoading && (events?.events.length ?? 0) === 0" class="mt-5 rounded-lg border border-border bg-surface p-6 text-text-muted">
        <p>{{ message("empty.events") }}</p>
        <AirButton
          class="mt-4"
          :label="message('action.start')"
          size="sm"
          @click="navigate('/fleet/aircraft')"
        />
      </div>
      <div class="mt-5 grid gap-3 lg:grid-cols-2">
        <article v-for="event in events?.events ?? []" :key="event.id" class="rounded-lg border border-border bg-surface p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-subtitle">
                {{ message(`event.${event.code}` as EventMessageKey) }}
              </h2>
              <p class="mt-1 text-caption text-text-muted">
                {{ message(`category.${event.category}`) }} · {{ date(event.occurred_at) }}
              </p>
            </div>
            <AirBadge :label="message(`severity.${event.severity}`)" :variant="tone(event.severity)" />
          </div>
          <p class="mt-3 text-text-muted">
            {{ details(event.parameters) }}
          </p>
          <AirButton
            class="mt-4"
            :label="message('action.open')"
            size="sm"
            variant="primary-soft"
            @click="navigate(event.target_path)"
          />
        </article>
      </div>
    </template>

    <template v-else>
      <div class="mt-5 flex flex-wrap gap-2">
        <AirButton
          :label="message('state.active')"
          size="sm"
          :variant="notificationState === 'active' ? 'primary' : 'primary-soft'"
          @click="notificationState = 'active'"
        />
        <AirButton
          :label="message('state.resolved')"
          size="sm"
          :variant="notificationState === 'resolved' ? 'primary' : 'primary-soft'"
          @click="notificationState = 'resolved'"
        />
        <AirButton
          v-if="notificationState === 'active'"
          :label="message('action.readAll')"
          size="sm"
          variant="primary-soft"
          @click="readAll"
        />
      </div>
      <p v-if="!isLoading && notifications.length === 0" class="mt-5 rounded-lg border border-border bg-surface p-6 text-text-muted">
        {{ message("empty.notifications") }}
      </p>
      <div class="mt-5 grid gap-3 lg:grid-cols-2">
        <button
          v-for="notification in notifications"
          :key="notification.id"
          class="rounded-lg border bg-surface p-4 text-left hover:bg-surface-subtle"
          :class="notification.is_read ? 'border-border' : 'border-primary'"
          type="button"
          @click="openNotification(notification)"
        >
          <div class="flex items-start justify-between gap-3">
            <strong>{{ message(`notification.${notification.code}` as EventMessageKey) }}</strong>
            <AirBadge :label="message(`severity.${notification.severity}`)" :variant="tone(notification.severity)" />
          </div>
          <p class="mt-2 text-text-muted">
            {{ details(notification.parameters) }}
          </p>
          <time class="mt-2 block text-caption text-text-muted">{{ date(notification.last_seen_at) }}</time>
        </button>
      </div>
    </template>
  </section>
</template>
