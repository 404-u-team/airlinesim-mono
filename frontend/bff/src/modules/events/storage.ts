/* eslint-disable @typescript-eslint/require-await -- storage API is async by contract over a synchronous SQLite store. */
import { resolve } from "node:path";

import type { StoredGameEvent, StoredNotification } from "./types";

import { readDocument, writeDocument } from "../../db/database";

const eventsLegacyPath = resolve(import.meta.dir, "../../../data/game-state/events.json");
const notificationsLegacyPath = resolve(import.meta.dir, "../../../data/game-state/notifications.json");

export async function listEventsForAirline(airlineId: string): Promise<StoredGameEvent[]> {
  return readEvents().filter((event) => event.airline_id === airlineId);
}

export async function listNotificationsForAirline(airlineId: string): Promise<StoredNotification[]> {
  return readNotifications().filter((notification) => notification.airline_id === airlineId);
}

export async function saveEvent(event: StoredGameEvent): Promise<StoredGameEvent> {
  const events = readEvents();
  const existing = events.find((item) => item.airline_id === event.airline_id && item.dedupe_key === event.dedupe_key);

  if (existing) {
    return existing;
  }

  const retained = [...events, event]
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
    .filter((item, index, source) => airlineRetention(item.airline_id, index, source, 1000));
  writeDocument("events", retained);

  return event;
}

export async function saveNotifications(notifications: StoredNotification[]): Promise<void> {
  const all = readNotifications();
  const airlineIds = new Set(notifications.map((item) => item.airline_id));
  const retained = all.filter((item) => !airlineIds.has(item.airline_id));

  for (const airlineId of airlineIds) {
    const airlineNotifications = notifications
      .filter((item) => item.airline_id === airlineId)
      .sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at));
    const active = airlineNotifications.filter((item) => item.state === "active");
    const ignored = airlineNotifications.filter((item) => item.state === "ignored").slice(0, 200);
    const resolved = airlineNotifications.filter((item) => item.state === "resolved").slice(0, 200);
    retained.push(...active, ...ignored, ...resolved);
  }

  writeDocument("notifications", retained);
}

function airlineRetention(
  airlineId: string,
  index: number,
  source: StoredGameEvent[],
  limit: number,
): boolean {
  return source.slice(0, index + 1).filter((item) => item.airline_id === airlineId).length <= limit;
}

function readEvents(): StoredGameEvent[] {
  return readDocument<StoredGameEvent[]>("events", [], eventsLegacyPath);
}

function readNotifications(): StoredNotification[] {
  return readDocument<StoredNotification[]>("notifications", [], notificationsLegacyPath);
}
