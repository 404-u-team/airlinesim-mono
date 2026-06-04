import { createApiClient, createAuthClient } from "@airlinesim/game-sdk";

import type { EventsResponse, NotificationItem } from "./types";

const authClient = createAuthClient();
const apiClient = createApiClient({ getToken: authClient.getAccessToken });

export async function getEvents(filters: { category?: string; severity?: string }): Promise<EventsResponse> {
  const query = new URLSearchParams();
  if (filters.category) {
    query.set("category", filters.category);
  }
  if (filters.severity) {
    query.set("severity", filters.severity);
  }

  return apiClient.get<EventsResponse>(`/events/feed?${query.toString()}`);
}

export async function getNotifications(state: "active" | "resolved"): Promise<NotificationItem[]> {
  const response = await apiClient.get<{ notifications: NotificationItem[] }>(`/notifications?state=${state}`);

  return response.notifications;
}

export async function markAllRead(): Promise<void> {
  await apiClient.post("/notifications/read-all");
}

export async function markRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${encodeURIComponent(id)}`, { is_read: true });
}

