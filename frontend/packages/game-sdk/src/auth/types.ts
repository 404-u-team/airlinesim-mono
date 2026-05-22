import type { DtoLoginRequest, DtoRegisterRequest } from "@airlinesim/api-contracts";

import type { ApiClient } from "../api";

export type AuthClient = {
  getAccessToken: () => null | string;
  isAuthenticated: () => boolean;
  login: (request: LoginRequest) => Promise<AuthSession>;
  logout: () => void;
  refresh: () => Promise<AuthSession>;
  register: (request: RegisterRequest) => Promise<AuthSession>;
  setAccessToken: (accessToken: null | string) => void;
};

export type AuthClientOptions = {
  apiClient?: ApiClient;
  baseUrl?: string;
  storage?: AuthTokenStorage;
  timeoutMs?: number;
};

export type AuthSession = {
  accessToken: string;
};

export type AuthTokenStorage = {
  clear: () => void;
  get: () => null | string;
  set: (accessToken: string) => void;
};

export type LoginRequest = DtoLoginRequest;

export type RegisterRequest = DtoRegisterRequest;
