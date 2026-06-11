import type {
  AirlinepbAirlineResponse,
  AirlinepbCreateAirlineResponse,
  DtoCreateAirlineRequestDTO,
} from "@airlinesim/api-contracts";

import { airlineSimEventBus } from "@airlinesim/event-bus";
import {
  ApiRequestError,
  type LoginRequest,
  type RegisterRequest,
} from "@airlinesim/game-sdk";
import { computed, reactive } from "vue";

import { getAdminSession } from "./admin/api/adminSessionApi";
import { authClient } from "./api";
import { createOnboardingAirline, getOnboardingSession } from "./onboarding/api";

const state = reactive({
  accessToken: authClient.getAccessToken(),
  adminCapabilities: [] as string[],
  adminSessionLoaded: false,
  airline: null as AirlinepbAirlineResponse | null,
  error: null as null | string,
  isRestoringSession: false,
  isSubmitting: false,
});

export const authState = {
  accessToken: computed(() => state.accessToken),
  adminCapabilities: computed(() => state.adminCapabilities),
  adminSessionLoaded: computed(() => state.adminSessionLoaded),
  airline: computed(() => state.airline),
  airlineName: computed(() => state.airline?.name ?? "AirlineSim"),
  error: computed(() => state.error),
  isAdminAuthorized: computed(() => state.adminCapabilities.includes("world.manage")),
  isAuthenticated: computed(() => Boolean(state.accessToken)),
  isRestoringSession: computed(() => state.isRestoringSession),
  isSubmitting: computed(() => state.isSubmitting),
};

export async function createMyAirline(
  request: DtoCreateAirlineRequestDTO,
): Promise<AirlinepbCreateAirlineResponse> {
  state.isSubmitting = true;
  state.error = null;

  try {
    const response = await createOnboardingAirline({
      iata_code: request.iata_code ?? "",
      icao_code: request.icao_code ?? "",
      name: request.name ?? "",
      starting_airport_id: request.starting_airport_id ?? "",
    });

     
    state.airline = response.airline;

    return response.airline;
  } catch (error) {
    state.error = getAuthErrorMessage(error);
    throw error;
  } finally {
    state.isSubmitting = false;
  }
}

export async function loadAdminSession(): Promise<void> {
  if (!state.accessToken) {
    setAdminSession([], true);
    return;
  }

  try {
    const session = await getAdminSession();
    setAdminSession(session.authorized ? session.capabilities : [], true);
  } catch (error) {
    setAdminSession([], true);
    if (error instanceof ApiRequestError && error.status === 401) {
      logout("expired");
    }
  }
}

export async function loadMyAirline(): Promise<AirlinepbAirlineResponse | null> {
  if (!state.accessToken) {
    state.airline = null;
    return null;
  }

  try {
    const session = await getOnboardingSession();
    if (session.airline) {
      // eslint-disable-next-line require-atomic-updates
      state.airline = session.airline;
      return session.airline;
    }
    // eslint-disable-next-line require-atomic-updates
    state.airline = null;
    return null;
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
      logout("expired");
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
  state.adminCapabilities = [];
  state.adminSessionLoaded = false;
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
    state.isRestoringSession = true;
    state.adminSessionLoaded = false;
    airlineSimEventBus.emit("auth:session-restored", { accessToken });
    void Promise.allSettled([loadMyAirline(), loadAdminSession()]).finally(() => {
      state.isRestoringSession = false;
    });
  } else {
    state.adminCapabilities = [];
    state.adminSessionLoaded = true;
  }
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    // Check if BFF returned a normalized error payload
    const data = error.data as null | Record<string, unknown>;
    if (data && typeof data === "object" && data.error && typeof data.error === "object") {
      const err = data.error as Record<string, unknown>;
      if (typeof err.code === "string" && err.code) {
        return `auth.error.${err.code}`;
      }
    }

    if (error.status === 400) {
      return "auth.error.invalidCredentials";
    }

    return error.message;
  }

  return "auth.error.default";
}

function setAdminSession(capabilities: string[], loaded: boolean): void {
  state.adminCapabilities = capabilities;
  state.adminSessionLoaded = loaded;
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
    state.adminSessionLoaded = false;
    await Promise.all([loadMyAirline(), loadAdminSession()]);
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
