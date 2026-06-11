export type FuelPriceChangedEvent = {
  price: number;
  recorded_at: string;
};

export type RealtimeClientOptions = {
  getToken?: () => null | string;
  path?: string;
  socketUrl?: string;
  transports?: RealtimeTransport[];
};

export type RealtimeTransport = "polling" | "websocket";
