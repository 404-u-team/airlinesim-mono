import { expect, test, mock } from "bun:test";
import { ref } from "vue";

// 1. Mock the DOM environment for vue-router
globalThis.window = {
  location: { pathname: "/", search: "", hash: "" },
  history: {
    length: 0,
    state: {},
    pushState: () => {},
    replaceState: () => {},
  },
  addEventListener: () => {},
  removeEventListener: () => {},
} as any;

globalThis.history = globalThis.window.history;
globalThis.location = globalThis.window.location;

globalThis.document = {
  querySelector: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
} as any;

// 2. Mock Vue SFC imports to return dummy components for vue-router
mock.module("../src/views/AuthView.vue", () => ({ default: { name: "AuthView" } }));
mock.module("../src/views/ShellRemoteView.vue", () => ({ default: { name: "ShellRemoteView" } }));
mock.module("../src/admin/views/AdminView.vue", () => ({ default: { name: "AdminView" } }));
mock.module("../src/views/SystemSettingsView.vue", () => ({ default: { name: "SystemSettingsView" } }));

// 3. Mock the auth module to control isAuthenticated and airline refs in tests
mock.module("../src/auth", () => {
  const isAuthenticated = ref(false);
  const isRestoringSession = ref(false);
  const airline = ref<any>(null);
  return {
    authState: {
      airline,
      isAuthenticated,
      isRestoringSession,
    },
  };
});

// 4. Import router after DOM and module mocks setup
const { router } = await import("../src/router");
const { authState } = await import("../src/auth");

test("Router Guard - unauthenticated redirects to /login", async () => {
  (authState.isAuthenticated as any).value = false;
  (authState.isRestoringSession as any).value = false;
  (authState.airline as any).value = null;

  await router.push("/dashboard");
  expect(router.currentRoute.value.path).toBe("/login");
});

test("Router Guard - authenticated without airline redirects to /onboarding/airline", async () => {
  (authState.isAuthenticated as any).value = true;
  (authState.isRestoringSession as any).value = false;
  (authState.airline as any).value = null;

  // Move away from onboarding route first to force a transition
  await router.push("/login");

  await router.push("/dashboard");
  expect(router.currentRoute.value.path).toBe("/onboarding/airline");
});

test("Router Guard - authenticated while restoring session does not redirect to onboarding early", async () => {
  (authState.isAuthenticated as any).value = true;
  (authState.isRestoringSession as any).value = true;
  (authState.airline as any).value = null;

  await router.push("/login");
  await router.push("/dashboard");

  expect(router.currentRoute.value.path).toBe("/dashboard");
});

test("Router Guard - authenticated with airline redirects away from onboarding/airline", async () => {
  (authState.isAuthenticated as any).value = true;
  (authState.isRestoringSession as any).value = false;
  (authState.airline as any).value = { id: "airline-1", name: "Capital Fly" };

  // Move away from onboarding route first to force a transition
  await router.push("/dashboard");

  await router.push("/onboarding/airline");
  expect(router.currentRoute.value.path).toBe("/dashboard");

  // Move to a public route, should redirect to dashboard
  await router.push("/login");
  expect(router.currentRoute.value.path).toBe("/dashboard");
});
