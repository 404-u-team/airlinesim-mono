import type { AuthTokenStorage } from "./types";

const tokenStorageKey = "airlinesim.accessToken";

export function createBrowserTokenStorage(storageKey = tokenStorageKey): AuthTokenStorage {
  return {
    clear: () => {
      getBrowserStorage()?.removeItem(storageKey);
    },
    get: () => getBrowserStorage()?.getItem(storageKey) ?? null,
    set: (accessToken) => {
      getBrowserStorage()?.setItem(storageKey, accessToken);
    },
  };
}

export function createMemoryTokenStorage(initialToken: null | string = null): AuthTokenStorage {
  let accessToken = initialToken;

  return {
    clear: () => {
      accessToken = null;
    },
    get: () => accessToken,
    set: (token) => {
      accessToken = token;
    },
  };
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}
