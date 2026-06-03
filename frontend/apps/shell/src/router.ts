import { createRouter, createWebHistory } from "vue-router";

import AdminView from "./admin/views/AdminView.vue";
import { authState } from "./auth";
import { createMfeRouteRecords, defaultRoutePath, resolveMfeRoute } from "./mfe-routing";
import AuthView from "./views/AuthView.vue";
import ShellRemoteView from "./views/ShellRemoteView.vue";
import SystemSettingsView from "./views/SystemSettingsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: defaultRoutePath,
    },
    {
      component: AuthView,
      meta: {
        public: true,
        publicLayout: true,
      },
      name: "login",
      path: "/login",
    },
    {
      component: AuthView,
      meta: {
        public: true,
        publicLayout: true,
      },
      name: "register",
      path: "/register",
    },
    {
      component: AuthView,
      meta: {
        public: false,
        publicLayout: true,
      },
      name: "onboarding-airline",
      path: "/onboarding/airline",
    },
    {
      path: "/admin",
      redirect: "/admin/countries",
    },
    {
      component: AdminView,
      name: "admin-future",
      path: "/admin/future/:futureEntity?",
    },
    {
      component: AdminView,
      name: "admin",
      path: "/admin/:entity",
    },
    {
      component: SystemSettingsView,
      name: "system",
      path: "/settings/system",
    },
    ...createMfeRouteRecords(ShellRemoteView),
    {
      path: "/:pathMatch(.*)*",
      redirect: defaultRoutePath,
    },
  ],
});

router.beforeEach((to) => {
  return getNavigationRedirect(
    to.path,
    to.fullPath,
    to.meta.public === true,
    authState.isAuthenticated.value,
    authState.isRestoringSession.value,
    authState.airline.value !== null,
  );
});

function checkMfeRedirect(toPath: string): boolean | string {
  const mfeRoute = resolveMfeRoute(toPath);
  if (!mfeRoute) {
    return true;
  }

  const { defaultPath, pathPrefix } = mfeRoute;
  if (defaultPath !== pathPrefix && toPath === pathPrefix) {
    return defaultPath;
  }

  return true;
}

function getNavigationRedirect(
  toPath: string,
  fullPath: string,
  isPublic: boolean,
  isAuthenticated: boolean,
  isRestoringSession: boolean,
  hasAirline: boolean,
): boolean | string | { path: string; query: { redirect: string } } {
  if (!isAuthenticated) {
    if (!isPublic) {
      return { path: "/login", query: { redirect: fullPath } };
    }
    return true;
  }

  if (isRestoringSession) {
    return true;
  }

  if (isPublic) {
    return hasAirline ? defaultRoutePath : "/onboarding/airline";
  }

  const isOnboardingRoute = toPath === "/onboarding/airline";
  if (!hasAirline) {
    return isOnboardingRoute ? true : "/onboarding/airline";
  }

  if (isOnboardingRoute) {
    return defaultRoutePath;
  }

  return checkMfeRedirect(toPath);
}
