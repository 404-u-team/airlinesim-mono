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

export type EventValidator<TPayload> = (payload: unknown) => payload is TPayload;

export type Unsubscribe = () => void;

export type ValidatorMap<TEvents extends EventMap> = Partial<{
  [TEvent in keyof TEvents & string]: EventValidator<TEvents[TEvent]>;
}>;
