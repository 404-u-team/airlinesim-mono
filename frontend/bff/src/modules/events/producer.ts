import type { EventInput, StoredGameEvent } from "./types";

import { saveEvent } from "./storage";

export async function recordGameEvent(input: EventInput): Promise<StoredGameEvent> {
  const event: StoredGameEvent = {
    ...input,
    created_at: new Date().toISOString(),
    id: crypto.randomUUID(),
  };

  return saveEvent(event);
}

