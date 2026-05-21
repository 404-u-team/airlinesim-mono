export type AirlineSimEvents = {
  "flight:selected": {
    flightId: string;
    source: "fleet-ops" | "map" | "shell";
  };
  "mfe:ready": {
    remoteId: string;
  };
  "navigation:remote-selected": {
    path?: string;
    remoteId: string;
  };
  "notification:created": {
    message: string;
    severity: "error" | "info" | "success" | "warning";
  };
  "shell:panel-requested": {
    panel: "flight-details" | "notifications" | "profile";
    payload?: Record<string, unknown>;
  };
};

export type EventBus<TEvents extends EventMap> = {
  clear: (event?: keyof TEvents & string) => void;
  emit: <TEvent extends keyof TEvents & string>(event: TEvent, payload: TEvents[TEvent]) => void;
  listenerCount: (event: keyof TEvents & string) => number;
  off: <TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ) => void;
  on: <TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ) => Unsubscribe;
  once: <TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ) => Unsubscribe;
};

export type EventHandler<TPayload> = (payload: TPayload) => void;

export type EventMap = Record<string, unknown>;

export type Unsubscribe = () => void;

type ListenerMap<TEvents extends EventMap> = Map<
  keyof TEvents & string,
  Set<EventHandler<TEvents[keyof TEvents]>>
>;

class InMemoryEventBus<TEvents extends EventMap> implements EventBus<TEvents> {
  private readonly listeners: ListenerMap<TEvents> = new Map();

  clear(event?: keyof TEvents & string): void {
    if (event) {
      this.listeners.delete(event);
      return;
    }

    this.listeners.clear();
  }

  emit<TEvent extends keyof TEvents & string>(
    event: TEvent,
    payload: TEvents[TEvent],
  ): void {
    const eventListeners = this.listeners.get(event);

    if (!eventListeners) {
      return;
    }

    [...eventListeners].forEach((handler) => {
      handler(payload);
    });
  }

  listenerCount(event: keyof TEvents & string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  off<TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ): void {
    const eventListeners = this.listeners.get(event);

    eventListeners?.delete(handler as EventHandler<TEvents[keyof TEvents]>);

    if (eventListeners?.size === 0) {
      this.listeners.delete(event);
    }
  }

  on<TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ): Unsubscribe {
    const eventListeners = this.getOrCreateListeners(event);

    eventListeners.add(handler as EventHandler<TEvents[keyof TEvents]>);

    return () => {
      this.off(event, handler);
    };
  }

  once<TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ): Unsubscribe {
    const unsubscribe = this.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });

    return unsubscribe;
  }

  private getOrCreateListeners(
    event: keyof TEvents & string,
  ): Set<EventHandler<TEvents[keyof TEvents]>> {
    const eventListeners =
      this.listeners.get(event) ?? new Set<EventHandler<TEvents[keyof TEvents]>>();

    this.listeners.set(event, eventListeners);

    return eventListeners;
  }
}

export function createEventBus<TEvents extends EventMap>(): EventBus<TEvents> {
  return new InMemoryEventBus<TEvents>();
}

export const airlineSimEventBus = createEventBus<AirlineSimEvents>();
