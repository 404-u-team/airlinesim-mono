import axios, {
  type AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";

import type { ApiClient, ApiClientOptions } from "./types";

import { getBackendBaseUrl } from "../config";
import { ApiRequestError } from "../errors";
import { normalizeBaseUrl } from "../utils/normalizeBaseUrl";

type AuthRetryRequestConfig = InternalAxiosRequestConfig & {
  authRetry?: boolean;
};

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
      const originalConfig = error.config as AuthRetryRequestConfig | undefined;

      if (
        error.response?.status === 401 &&
        options.refreshToken &&
        originalConfig &&
        !originalConfig.authRetry
      ) {
        originalConfig.authRetry = true;
        const refreshedToken = await options.refreshToken();

        if (refreshedToken) {
          const headers = AxiosHeaders.from(originalConfig.headers);
          headers.set("Authorization", `Bearer ${refreshedToken}`);
          originalConfig.headers = headers;

          return instance.request(originalConfig);
        }
      }

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

function normalizeApiError(error: AxiosError): ApiRequestError {
  return new ApiRequestError(
    error.message,
    error.response?.status ?? null,
    error.response?.data ?? null,
  );
}

async function unwrap<TResponse>(request: Promise<AxiosResponse<TResponse>>): Promise<TResponse> {
  const response = await request;

  return response.data;
}
