import type { NotificationRisk, StoredNotification } from "./types";

import { recordGameEvent } from "./producer";
import { listNotificationsForAirline, saveNotifications } from "./storage";

export async function ignoreNotification(
  airlineId: string,
  notificationId: string,
): Promise<null | StoredNotification> {
  const notifications = await listNotificationsForAirline(airlineId);
  const notification = notifications.find((item) => item.id === notificationId);

  if (!notification) {
    return null;
  }

  const updated = {
    ...notification,
    is_read: true,
    last_seen_at: new Date().toISOString(),
    state: "ignored" as const,
  };
  await saveNotifications(notifications.map((item) => item.id === notificationId ? updated : item));

  return updated;
}

export async function markAllNotificationsRead(airlineId: string): Promise<StoredNotification[]> {
  const notifications = (await listNotificationsForAirline(airlineId)).map((item) => ({
    ...item,
    is_read: item.state === "active" ? true : item.is_read,
  }));
  await saveNotifications(notifications);

  return notifications;
}

export async function patchNotificationRead(
  airlineId: string,
  notificationId: string,
  isRead: boolean,
): Promise<null | StoredNotification> {
  const notifications = await listNotificationsForAirline(airlineId);
  const notification = notifications.find((item) => item.id === notificationId);

  if (!notification) {
    return null;
  }

  const updated = { ...notification, is_read: isRead };
  await saveNotifications(notifications.map((item) => item.id === notificationId ? updated : item));

  return updated;
}

export async function reconcileNotificationRisks(
  airlineId: string,
  risks: NotificationRisk[],
): Promise<StoredNotification[]> {
  const now = new Date().toISOString();
  const current = await listNotificationsForAirline(airlineId);
  const riskByKey = new Map(risks.map((risk) => [risk.dedupe_key, risk]));
  const currentByKey = new Map(current.map((notification) => [notification.dedupe_key, notification]));
  const reconciled = current.map((notification) => reconcileExisting(notification, riskByKey.get(notification.dedupe_key), now));

  for (const risk of risks) {
    if (!currentByKey.has(risk.dedupe_key)) {
      reconciled.push(newNotification(risk, now));
    }
  }

  await saveNotifications(reconciled);
  await Promise.all(reconciled
    .filter((notification) => !currentByKey.has(notification.dedupe_key))
    .map(async (notification) => recordGameEvent({
      airline_id: airlineId,
      category: notificationCategory(notification.code),
      code: "WARNING_CREATED",
      dedupe_key: `warning-created:${notification.id}`,
      occurred_at: now,
      parameters: { notification_code: notification.code, ...notification.parameters },
      related: notification.related,
      severity: notification.severity,
      source_id: notification.id,
      source_type: "system",
      target_path: notification.target_path,
    })));
  await Promise.all(current
    .filter((notification) => notification.state === "active" && !riskByKey.has(notification.dedupe_key))
    .map(async (notification) => recordGameEvent({
      airline_id: airlineId,
      category: "system",
      code: "WARNING_RESOLVED",
      dedupe_key: `warning-resolved:${notification.id}`,
      occurred_at: now,
      parameters: { notification_code: notification.code },
      related: notification.related,
      severity: "success",
      source_id: notification.id,
      source_type: "system",
      target_path: notification.target_path,
    })));

  return reconciled;
}

function newNotification(risk: NotificationRisk, now: string): StoredNotification {
  return {
    ...risk,
    first_seen_at: now,
    id: crypto.randomUUID(),
    is_read: false,
    last_seen_at: now,
    state: "active",
  };
}

function notificationCategory(code: StoredNotification["code"]): "finance" | "fleet" | "operations" {
  if (["BANKRUPTCY_FLAG", "LOW_BALANCE", "ROUTE_LOSS", "WEEKLY_OPERATING_LOSS"].includes(code)) {
    return "finance";
  }

  return code === "LOW_MAINTENANCE" || code === "BASE_AIRCRAFT_INCOMPATIBLE" ? "fleet" : "operations";
}

function reconcileExisting(
  notification: StoredNotification,
  risk: NotificationRisk | undefined,
  now: string,
): StoredNotification {
  if (!risk) {
    return notification.state === "resolved"
      ? notification
      : { ...notification, resolved_at: now, state: "resolved" };
  }

  if (notification.state === "ignored") {
    return {
      ...notification,
      ...risk,
      is_read: true,
      last_seen_at: now,
      resolved_at: undefined,
      state: "ignored",
    };
  }

  return {
    ...notification,
    ...risk,
    is_read: notification.state === "resolved" ? false : notification.is_read,
    last_seen_at: now,
    resolved_at: undefined,
    state: "active",
  };
}
