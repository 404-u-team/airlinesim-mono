export type AirlineSimEvents = {
  "navigation:remote-selected": {
    remoteId: string;
  };
  "notification:created": {
    message: string;
    severity: "error" | "info" | "success" | "warning";
  };
};

export type EventBus<TEvents extends EventMap> = {
  emit: <TEvent extends keyof TEvents & string>(event: TEvent, payload: TEvents[TEvent]) => void;
  off: <TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ) => void;
  on: <TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ) => Unsubscribe;
};

export type EventHandler<TPayload> = (payload: TPayload) => void;

export type EventMap = Record<string, unknown>;

export type Unsubscribe = () => void;

export function createEventBus<TEvents extends EventMap>(): EventBus<TEvents> {
  const listeners = new Map<keyof TEvents & string, Set<EventHandler<TEvents[keyof TEvents]>>>();

  function emit<TEvent extends keyof TEvents & string>(
    event: TEvent,
    payload: TEvents[TEvent],
  ): void {
    listeners.get(event)?.forEach((handler) => {
      handler(payload);
    });
  }

  function off<TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ): void {
    listeners.get(event)?.delete(handler as EventHandler<TEvents[keyof TEvents]>);
  }

  function on<TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ): Unsubscribe {
    const eventListeners = listeners.get(event) ?? new Set<EventHandler<TEvents[keyof TEvents]>>();

    eventListeners.add(handler as EventHandler<TEvents[keyof TEvents]>);
    listeners.set(event, eventListeners);

    return () => {
      off(event, handler);
    };
  }

  return {
    emit,
    off,
    on,
  };
}

export const airlineSimEventBus = createEventBus<AirlineSimEvents>();
