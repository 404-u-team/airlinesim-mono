import type { Notification, NotificationSummary } from "./types";

import { apiClient } from "../api";

export async function getNotifications(): Promise<Notification[]> {
  const response = await apiClient.get<{ notifications: Notification[] }>("/notifications?state=active");

  return response.notifications;
}

export async function getNotificationSummary(): Promise<NotificationSummary> {
  return apiClient.get<NotificationSummary>("/notifications/summary");
}

export async function ignoreNotification(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${encodeURIComponent(id)}`, { state: "ignored" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post("/notifications/read-all");
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${encodeURIComponent(id)}`, { is_read: true });
}

