export type RealtimeClientOptions = {
  getToken?: () => null | string;
  path?: string;
  socketUrl?: string;
  transports?: RealtimeTransport[];
};

export type RealtimeTransport = "polling" | "websocket";
