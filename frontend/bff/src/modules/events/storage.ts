import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { StoredGameEvent, StoredNotification } from "./types";

const eventsPath = resolve(import.meta.dir, "../../../data/game-state/events.json");
const notificationsPath = resolve(import.meta.dir, "../../../data/game-state/notifications.json");
let eventsMutationQueue: Promise<unknown> = Promise.resolve();
let notificationsMutationQueue: Promise<unknown> = Promise.resolve();

export async function listEventsForAirline(airlineId: string): Promise<StoredGameEvent[]> {
  return (await readArray<StoredGameEvent>(eventsPath)).filter((event) => event.airline_id === airlineId);
}

export async function listNotificationsForAirline(airlineId: string): Promise<StoredNotification[]> {
  return (await readArray<StoredNotification>(notificationsPath)).filter((notification) => notification.airline_id === airlineId);
}

export async function saveEvent(event: StoredGameEvent): Promise<StoredGameEvent> {
  return queuedEventsMutation(async () => {
    const events = await readArray<StoredGameEvent>(eventsPath);
    const existing = events.find((item) => item.airline_id === event.airline_id && item.dedupe_key === event.dedupe_key);

    if (existing) {
      return existing;
    }

    const retained = [...events, event]
      .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
      .filter((item, index, source) => airlineRetention(item.airline_id, index, source, 1000));
    await writeArray(eventsPath, retained);

    return event;
  });
}

export async function saveNotifications(notifications: StoredNotification[]): Promise<void> {
  await queuedNotificationsMutation(async () => {
    const all = await readArray<StoredNotification>(notificationsPath);
    const airlineIds = new Set(notifications.map((item) => item.airline_id));
    const retained = all.filter((item) => !airlineIds.has(item.airline_id));

    for (const airlineId of airlineIds) {
      const airlineNotifications = notifications
        .filter((item) => item.airline_id === airlineId)
        .sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at));
      const active = airlineNotifications.filter((item) => item.state === "active");
      const resolved = airlineNotifications.filter((item) => item.state === "resolved").slice(0, 200);
      retained.push(...active, ...resolved);
    }

    await writeArray(notificationsPath, retained);
  });
}

function airlineRetention(
  airlineId: string,
  index: number,
  source: StoredGameEvent[],
  limit: number,
): boolean {
  return source.slice(0, index + 1).filter((item) => item.airline_id === airlineId).length <= limit;
}

async function queuedEventsMutation<TValue>(mutation: () => Promise<TValue>): Promise<TValue> {
  const next = eventsMutationQueue.then(mutation, mutation);
  eventsMutationQueue = next.catch(() => undefined);

  return next;
}

async function queuedNotificationsMutation<TValue>(mutation: () => Promise<TValue>): Promise<TValue> {
  const next = notificationsMutationQueue.then(mutation, mutation);
  notificationsMutationQueue = next.catch(() => undefined);

  return next;
}

async function readArray<TValue>(path: string): Promise<TValue[]> {
  try {
    const payload = JSON.parse(await readFile(path, "utf8")) as unknown;

    return Array.isArray(payload) ? (payload as TValue[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeArray(path: string, value: unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const temporaryPath = `${path}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(value, null, 2));
  await rename(temporaryPath, path);
}
