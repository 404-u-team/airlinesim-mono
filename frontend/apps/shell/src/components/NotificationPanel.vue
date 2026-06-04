<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { X } from "@lucide/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { Notification } from "../notifications/types";

import { notificationState, refreshNotifications } from "../notifications/state";

const props = defineProps<{
  appLocale: Locale;
}>();
const emit = defineEmits<{
  close: [];
  "mark-all": [];
  open: [notification: Notification];
}>();
const messages = {
  en: {
    active: "active",
    close: "Close notifications",
    empty: "No active notifications require attention.",
    error: "Notifications could not be loaded.",
    loading: "Loading...",
    markAll: "Mark all read",
    retry: "Retry",
    title: "Notifications",
  },
  ru: {
    active: "активных",
    close: "Закрыть уведомления",
    empty: "Нет активных уведомлений, требующих внимания.",
    error: "Не удалось загрузить уведомления.",
    loading: "Загрузка...",
    markAll: "Прочитать все",
    retry: "Повторить",
    title: "Уведомления",
  },
};
const notificationMessages: Record<string, Record<Locale, string>> = {
  BANKRUPTCY_FLAG: { en: "The airline is marked bankrupt.", ru: "Авиакомпания отмечена как банкрот." },
  BASE_AIRCRAFT_INCOMPATIBLE: { en: "An aircraft is incompatible with the base runway.", ru: "Самолет несовместим с ВПП базы." },
  BASE_NIGHT_OPS_CONFLICT: { en: "A schedule conflicts with base night operations.", ru: "Расписание конфликтует с ночными ограничениями базы." },
  BASE_SLOT_CAPACITY_EXCEEDED: { en: "Planned runway use exceeds base capacity.", ru: "Плановая нагрузка превышает пропускную способность базы." },
  BASE_SLOT_CAPACITY_LOW: { en: "Base planning headroom is running low.", ru: "Плановый запас пропускной способности базы заканчивается." },
  LOW_BALANCE: { en: "Cash balance is critically low.", ru: "Остаток денежных средств критически низкий." },
  LOW_MAINTENANCE: { en: "Aircraft maintenance requires attention.", ru: "Техническое состояние самолетов требует внимания." },
  ROUTE_LOSS: { en: "A route is operating at a loss.", ru: "Маршрут приносит убыток." },
  ROUTES_AWAITING_SCHEDULE: { en: "Routes are waiting for a schedule.", ru: "Маршруты ожидают расписания." },
  SCHEDULE_BLOCKED: { en: "A schedule is blocked.", ru: "Расписание заблокировано." },
  WEEKLY_OPERATING_LOSS: { en: "Weekly operations are loss-making.", ru: "Недельные операции убыточны." },
};
const severityMessages = {
  en: { danger: "Critical", info: "Info", success: "Success", warning: "Warning" },
  ru: { danger: "Критично", info: "Информация", success: "Успех", warning: "Предупреждение" },
};
const text = computed(() => messages[props.appLocale]);
const panel = ref<HTMLElement | null>(null);

onMounted(() => {
  panel.value?.focus();
  window.addEventListener("keydown", closeOnEscape);
});
onUnmounted(() => window.removeEventListener("keydown", closeOnEscape));

function closeOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  }
}

function notificationText(notification: Notification): string {
  return notificationMessages[notification.code]?.[props.appLocale] ?? notificationMessages[notification.code]?.en ?? notification.code;
}

function variant(notification: Notification): "danger-soft" | "primary-soft" | "success-soft" | "warning-soft" {
  return notification.severity === "info" ? "primary-soft" : `${notification.severity}-soft`;
}
</script>

<template>
  <aside
    ref="panel"
    aria-modal="true"
    class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface shadow-xl outline-none"
    role="dialog"
    tabindex="-1"
  >
    <header class="flex items-center justify-between gap-3 border-b border-border p-4">
      <div>
        <h2 class="text-h3">
          {{ text.title }}
        </h2>
        <p class="text-caption text-text-muted">
          {{ notificationState.summary.value.active_count }} {{ text.active }}
        </p>
      </div>
      <button
        :aria-label="text.close"
        class="rounded-lg p-2 hover:bg-surface-subtle"
        type="button"
        @click="emit('close')"
      >
        <X :size="20" />
      </button>
    </header>
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="notificationState.error.value" class="mb-3 rounded-lg border border-error bg-error-bg p-3">
        <p>{{ text.error }}</p>
        <AirButton
          class="mt-2"
          :label="text.retry"
          size="sm"
          variant="primary-soft"
          @click="refreshNotifications"
        />
      </div>
      <div v-if="notificationState.isLoading.value && notificationState.notifications.value.length === 0" class="text-text-muted">
        {{ text.loading }}
      </div>
      <p v-else-if="notificationState.notifications.value.length === 0" class="rounded-lg border border-border p-5 text-text-muted">
        {{ text.empty }}
      </p>
      <button
        v-for="notification in notificationState.notifications.value"
        :key="notification.id"
        class="mb-3 block w-full rounded-lg border p-4 text-left hover:bg-surface-subtle"
        :class="notification.is_read ? 'border-border' : 'border-primary'"
        type="button"
        @click="emit('open', notification)"
      >
        <div class="flex items-start justify-between gap-3">
          <strong>{{ notificationText(notification) }}</strong>
          <AirBadge :label="severityMessages[appLocale][notification.severity]" :variant="variant(notification)" />
        </div>
        <time class="mt-2 block text-caption text-text-muted">{{ new Intl.DateTimeFormat(appLocale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(notification.last_seen_at)) }}</time>
      </button>
    </div>
    <footer class="border-t border-border p-4">
      <AirButton
        :disabled="notificationState.unreadCount.value === 0"
        :label="text.markAll"
        size="sm"
        variant="primary-soft"
        @click="emit('mark-all')"
      />
    </footer>
  </aside>
</template>
