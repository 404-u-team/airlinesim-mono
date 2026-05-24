import type {
  AirlinepbAirlineResponse,
  AirlinepbCreateAirlineResponse,
  DtoCreateAirlineRequestDTO,
} from "@airlinesim/api-contracts";

import { airlineSimEventBus } from "@airlinesim/event-bus";
import {
  ApiRequestError,
  createApiClient,
  createAuthClient,
  type LoginRequest,
  type RegisterRequest,
} from "@airlinesim/game-sdk";
import { computed, reactive } from "vue";

const authClient = createAuthClient();
const apiClient = createApiClient({
  getToken: authClient.getAccessToken,
});

const state = reactive({
  accessToken: authClient.getAccessToken(),
  airline: null as AirlinepbAirlineResponse | null,
  error: null as null | string,
  isSubmitting: false,
});

export const authState = {
  accessToken: computed(() => state.accessToken),
  airline: computed(() => state.airline),
  airlineName: computed(() => state.airline?.name ?? "AirlineSim"),
  error: computed(() => state.error),
  isAuthenticated: computed(() => Boolean(state.accessToken)),
  isSubmitting: computed(() => state.isSubmitting),
};

export async function createMyAirline(
  request: DtoCreateAirlineRequestDTO,
): Promise<AirlinepbCreateAirlineResponse> {
  state.isSubmitting = true;
  state.error = null;

  try {
    const response = await apiClient.post<AirlinepbCreateAirlineResponse>("/airline", request);
    await loadMyAirline();

    return response;
  } catch (error) {
    state.error = getAuthErrorMessage(error);
    throw error;
  } finally {
    state.isSubmitting = false;
  }
}

export async function loadMyAirline(): Promise<AirlinepbAirlineResponse | null> {
  if (!state.accessToken) {
    state.airline = null;
    return null;
  }

  try {
    const airline = await apiClient.get<AirlinepbAirlineResponse>("/airline/me");
    // eslint-disable-next-line require-atomic-updates
    state.airline = airline;

    return airline;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      state.airline = null;
      return null;
    }

    throw error;
  }
}

export async function login(request: LoginRequest): Promise<void> {
  await submitAuth("login", async () => authClient.login(request));
}

export function logout(reason: "expired" | "manual" = "manual"): void {
  authClient.logout();
  state.accessToken = null;
  state.airline = null;
  state.error = null;
  airlineSimEventBus.emit("auth:logout", { reason });
}

export async function register(request: RegisterRequest): Promise<void> {
  await submitAuth("register", async () => authClient.register(request));
}

export function restoreAuthSession(): void {
  const accessToken = authClient.getAccessToken();
  state.accessToken = accessToken;

  if (accessToken) {
    airlineSimEventBus.emit("auth:session-restored", { accessToken });
    void loadMyAirline();
  }
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 400) {
      return "auth.error.invalidCredentials";
    }

    return error.message;
  }

  return "auth.error.default";
}

async function submitAuth(
  mode: "login" | "register",
  action: () => Promise<{ accessToken: string }>,
): Promise<void> {
  state.isSubmitting = true;
  state.error = null;

  try {
    const session = await action();
    state.accessToken = session.accessToken;
    await loadMyAirline();
    airlineSimEventBus.emit(
      mode === "login" ? "auth:login-succeeded" : "auth:register-succeeded",
      { accessToken: session.accessToken },
    );
  } catch (error) {
    const message = getAuthErrorMessage(error);
    state.error = message;
    airlineSimEventBus.emit(
      mode === "login" ? "auth:login-failed" : "auth:register-failed",
      { message },
    );
    throw error;
  } finally {
    state.isSubmitting = false;
  }
}
