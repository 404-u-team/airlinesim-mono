import { computed, reactive } from "vue";

import type { Notification, NotificationSummary } from "./types";

import {
  getNotifications,
  getNotificationSummary,
  ignoreNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "./api";

const emptySummary: NotificationSummary = {
  active_count: 0,
  danger_count: 0,
  latest: [],
  unread_active_count: 0,
  warning_count: 0,
};
const state = reactive({
  error: "",
  isLoading: false,
  notifications: [] as Notification[],
  summary: { ...emptySummary },
});
let activeRequest: null | Promise<void> = null;

export const notificationState = {
  error: computed(() => state.error),
  isLoading: computed(() => state.isLoading),
  notifications: computed(() => state.notifications),
  summary: computed(() => state.summary),
  unreadCount: computed(() => state.summary.unread_active_count),
};

export function clearNotifications(): void {
  state.error = "";
  state.isLoading = false;
  state.notifications = [];
  state.summary = { ...emptySummary };
}

export async function ignore(id: string): Promise<void> {
  await ignoreNotification(id);
  await refreshNotifications();
}

export async function markAllRead(): Promise<void> {
  await markAllNotificationsRead();
  await refreshNotifications();
}

export async function markRead(id: string): Promise<void> {
  await markNotificationRead(id);
  await refreshNotifications();
}

export async function refreshNotifications(): Promise<void> {
  if (activeRequest) {
    return activeRequest;
  }

  state.isLoading = true;
  state.error = "";
  activeRequest = Promise.all([getNotificationSummary(), getNotifications()])
    .then(([summary, notifications]) => {
      state.summary = summary;
      state.notifications = notifications;
    })
    .catch((error: unknown) => {
      state.error = error instanceof Error ? error.message : "Notifications unavailable.";
    })
    .finally(() => {
      state.isLoading = false;
      activeRequest = null;
    });

  return activeRequest;
}

