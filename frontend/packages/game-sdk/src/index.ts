import axios, {
  type AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";

export type { Airline, Airport, Flight, FlightStatus } from "@airlinesim/api-contracts";

export type ApiClient = {
  axios: AxiosInstance;
  baseUrl: string;
  delete: <TResponse>(path: string, config?: AxiosRequestConfig) => Promise<TResponse>;
  get: <TResponse>(path: string, config?: AxiosRequestConfig) => Promise<TResponse>;
  patch: <TResponse>(
    path: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ) => Promise<TResponse>;
  post: <TResponse>(
    path: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ) => Promise<TResponse>;
  put: <TResponse>(
    path: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ) => Promise<TResponse>;
  request: <TResponse>(config: AxiosRequestConfig) => Promise<TResponse>;
};

export type ApiClientOptions = {
  baseUrl?: string;
  getToken?: () => null | string;
  onError?: (error: ApiRequestError) => void;
  timeoutMs?: number;
};

export type RealtimeClientOptions = {
  getToken?: () => null | string;
  path?: string;
  socketUrl?: string;
  transports?: RealtimeTransport[];
};

export type RealtimeTransport = "polling" | "websocket";

const defaultBackendUrl = "http://localhost:8080";
const defaultSocketTransports: RealtimeTransport[] = ["websocket", "polling"];

export class ApiRequestError extends Error {
  readonly data: unknown;

  readonly status: null | number;

  constructor(message: string, status: null | number, data: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
  }
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? getBackendBaseUrl());
  const instance = axios.create({
    baseURL: baseUrl,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    timeout: options.timeoutMs ?? 20_000,
  });

  instance.interceptors.request.use((config) => {
    const token = options.getToken?.();

    if (token) {
      const headers = AxiosHeaders.from(config.headers);
      headers.set("Authorization", `Bearer ${token}`);
      config.headers = headers;
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const apiError = normalizeApiError(error);
      options.onError?.(apiError);

      return Promise.reject(apiError);
    },
  );

  return {
    axios: instance,
    baseUrl,
    delete: async (path, config) => unwrap(instance.delete(path, config)),
    get: async (path, config) => unwrap(instance.get(path, config)),
    patch: async (path, body, config) => unwrap(instance.patch(path, body, config)),
    post: async (path, body, config) => unwrap(instance.post(path, body, config)),
    put: async (path, body, config) => unwrap(instance.put(path, body, config)),
    request: async (config) => unwrap(instance.request(config)),
  };
}

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

export function getBackendBaseUrl(): string {
  return getEnvValue("VITE_BACKEND_URL") ?? defaultBackendUrl;
}

export function getSocketBaseUrl(): string {
  return getEnvValue("VITE_SOCKET_URL") ?? getBackendBaseUrl();
}

function getEnvValue(key: "VITE_BACKEND_URL" | "VITE_SOCKET_URL"): string | undefined {
  return import.meta.env[key] ?? undefined;
}

function normalizeApiError(error: AxiosError): ApiRequestError {
  return new ApiRequestError(
    error.message,
    error.response?.status ?? null,
    error.response?.data ?? null,
  );
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function unwrap<TResponse>(request: Promise<AxiosResponse<TResponse>>): Promise<TResponse> {
  const response = await request;

  return response.data;
}
