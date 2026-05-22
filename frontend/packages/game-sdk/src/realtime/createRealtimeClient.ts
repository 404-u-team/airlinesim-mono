import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";

import type { RealtimeClientOptions, RealtimeTransport } from "./types";

import { getSocketBaseUrl } from "../config";
import { normalizeBaseUrl } from "../utils/normalizeBaseUrl";

const defaultSocketTransports: RealtimeTransport[] = ["websocket", "polling"];

export function createRealtimeClient(options: RealtimeClientOptions = {}): Socket {
  const token = options.getToken?.();
  const socketOptions: Partial<ManagerOptions & SocketOptions> = {
    auth: token ? { token } : undefined,
    path: options.path ?? "/socket.io",
    transports: options.transports ?? defaultSocketTransports,
    withCredentials: true,
  };

  return io(normalizeBaseUrl(options.socketUrl ?? getSocketBaseUrl()), socketOptions);
}
