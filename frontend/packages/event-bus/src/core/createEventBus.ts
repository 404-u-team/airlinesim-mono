import type {
  EventBus,
  EventHandler,
  EventMap,
  ValidatorMap,
} from "./types";

type ListenerMap<TEvents extends EventMap> = Map<
  keyof TEvents & string,
  Set<EventHandler<TEvents[keyof TEvents]>>
>;

class InMemoryEventBus<TEvents extends EventMap> implements EventBus<TEvents> {
  private readonly listeners: ListenerMap<TEvents> = new Map();

  private readonly validators: ValidatorMap<TEvents>;

  constructor(validators: ValidatorMap<TEvents> = {}) {
    this.validators = validators;
  }

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
    const validator = this.validators[event];

    if (validator && !validator(payload)) {
      throw new TypeError(`Invalid event payload for ${event}`);
    }

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
  ): () => void {
    const eventListeners = this.getOrCreateListeners(event);

    eventListeners.add(handler as EventHandler<TEvents[keyof TEvents]>);

    return () => {
      this.off(event, handler);
    };
  }

  once<TEvent extends keyof TEvents & string>(
    event: TEvent,
    handler: EventHandler<TEvents[TEvent]>,
  ): () => void {
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

export function createEventBus<TEvents extends EventMap>(
  validators?: ValidatorMap<TEvents>,
): EventBus<TEvents> {
  return new InMemoryEventBus<TEvents>(validators);
}
