import type { BffConfig } from "../../config";
import type { StoredGameEvent, StoredNotification } from "./types";

import { BackendHttpError } from "../../backend-http";
import { jsonResponse, readJson } from "../../http";
import { loadFleetSnapshot } from "../fleet/snapshot";
import { markAllNotificationsRead, patchNotificationRead } from "./notifications";
import { reconcileNotificationsForRequest } from "./reconcile";
import { listEventsForAirline } from "./storage";

export async function handleEventsRequest(
  request: Request,
  url: URL,
  config: BffConfig,
): Promise<null | Response> {
  if (!url.pathname.startsWith("/events/") && !url.pathname.startsWith("/notifications")) {
    return null;
  }

  try {
    const snapshot = await loadFleetSnapshot(request, config);
    const airlineId = snapshot.airline.id ?? "";

    if (url.pathname.startsWith("/events/")) {
      return await eventRequest(request, url, airlineId);
    }

    return await notificationRequest(request, url, config, airlineId);
  } catch (error) {
    return eventError(error);
  }
}

function buildEventFeed(events: StoredGameEvent[], searchParams: URLSearchParams): Record<string, unknown> {
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "50"), 1), 100);
  const filtered = events
    .filter((item) => !searchParams.get("category") || item.category === searchParams.get("category"))
    .filter((item) => !searchParams.get("severity") || item.severity === searchParams.get("severity"))
    .filter((item) => !searchParams.get("from") || item.occurred_at >= (searchParams.get("from") ?? ""))
    .filter((item) => !searchParams.get("to") || item.occurred_at <= (searchParams.get("to") ?? ""))
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at));
  const cursor = Number(searchParams.get("cursor") ?? "0");
  const page = filtered.slice(cursor, cursor + limit);

  return {
    counts: {
      categories: countBy(filtered, "category"),
      severities: countBy(filtered, "severity"),
    },
    events: page,
    generated_at: new Date().toISOString(),
    next_cursor: cursor + page.length < filtered.length ? String(cursor + page.length) : null,
  };
}

function countBy<TValue extends Record<string, unknown>>(items: TValue[], key: keyof TValue): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const value = String(item[key]);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function eventError(error: unknown): Response {
  if (error instanceof BackendHttpError) {
    return jsonResponse(error.toNormalizedJson(), { status: error.status });
  }

  return jsonResponse({ error: { code: "EVENTS_ERROR", message: error instanceof Error ? error.message : "Events request failed." } }, { status: 500 });
}

async function eventRequest(request: Request, url: URL, airlineId: string): Promise<Response> {
  const events = await listEventsForAirline(airlineId);
  const match = /^\/events\/feed\/([^/]+)$/.exec(url.pathname);

  if (request.method === "GET" && match?.[1]) {
    const eventId = decodeURIComponent(match[1]);
    const event = events.find((item) => item.id === eventId);
    return event
      ? jsonResponse({ event })
      : jsonResponse({ error: { code: "EVENT_NOT_FOUND", message: "Event not found." } }, { status: 404 });
  }
  if (request.method === "GET" && url.pathname === "/events/feed") {
    return jsonResponse(buildEventFeed(events, url.searchParams));
  }

  return jsonResponse({ error: { code: "EVENTS_NOT_FOUND", message: "Events endpoint not found." } }, { status: 404 });
}

function filterNotifications(notifications: StoredNotification[], searchParams: URLSearchParams): StoredNotification[] {
  const state = searchParams.get("state") ?? "active";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "100"), 1), 200);

  return notifications
    .filter((item) => state === "all" || item.state === state)
    .filter((item) => searchParams.get("unread_only") !== "true" || !item.is_read)
    .filter((item) => !searchParams.get("severity") || item.severity === searchParams.get("severity"))
    .sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at))
    .slice(0, limit);
}

async function notificationRequest(
  request: Request,
  url: URL,
  config: BffConfig,
  airlineId: string,
): Promise<Response> {
  const reconciled = await reconcileNotificationsForRequest(request, config);

  if (request.method === "GET" && url.pathname === "/notifications") {
    return jsonResponse({ notifications: filterNotifications(reconciled, url.searchParams) });
  }
  if (request.method === "GET" && url.pathname === "/notifications/summary") {
    return jsonResponse(notificationSummary(reconciled));
  }
  if (request.method === "POST" && url.pathname === "/notifications/read-all") {
    return jsonResponse({ notifications: await markAllNotificationsRead(airlineId) });
  }
  const match = /^\/notifications\/([^/]+)$/.exec(url.pathname);
  if (request.method === "PATCH" && match?.[1]) {
    const payload = await readJson<{ is_read?: boolean }>(request);
    const notification = await patchNotificationRead(airlineId, decodeURIComponent(match[1]), payload.is_read === true);
    return notification
      ? jsonResponse({ notification })
      : jsonResponse({ error: { code: "NOTIFICATION_NOT_FOUND", message: "Notification not found." } }, { status: 404 });
  }

  return jsonResponse({ error: { code: "NOTIFICATIONS_NOT_FOUND", message: "Notifications endpoint not found." } }, { status: 404 });
}

function notificationSummary(notifications: StoredNotification[]): Record<string, unknown> {
  const active = notifications.filter((item) => item.state === "active");

  return {
    active_count: active.length,
    danger_count: active.filter((item) => item.severity === "danger").length,
    latest: active.slice().sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at)).slice(0, 5),
    unread_active_count: active.filter((item) => !item.is_read).length,
    warning_count: active.filter((item) => item.severity === "warning").length,
  };
}
