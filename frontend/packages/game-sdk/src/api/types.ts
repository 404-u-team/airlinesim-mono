import type { AxiosInstance, AxiosRequestConfig } from "axios";

import type { ApiRequestError } from "../errors";

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
  refreshToken?: () => Promise<null | string>;
  timeoutMs?: number;
};
