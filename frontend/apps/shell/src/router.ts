import { createRouter, createWebHistory } from "vue-router";

import AdminView from "./admin/views/AdminView.vue";
import { authState } from "./auth";
import DashboardView from "./dashboard/DashboardView.vue";
import { createMfeRouteRecords, defaultRoutePath, resolveMfeRoute } from "./mfe-routing";
import AuthView from "./views/AuthView.vue";
import KnowledgeBaseView from "./views/KnowledgeBaseView.vue";
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
      component: DashboardView,
      name: "dashboard",
      path: "/dashboard",
    },
    {
      component: KnowledgeBaseView,
      name: "knowledge-base",
      path: "/knowledge-base/:article?",
    },
    {
      meta: {
        adminLayout: true,
        requiresAdmin: true,
      },
      path: "/admin",
      redirect: "/admin/overview",
    },
    {
      meta: {
        adminLayout: true,
        requiresAdmin: true,
      },
      path: "/admin/future/:futureEntity?",
      redirect: "/admin/capabilities",
    },
    {
      component: AdminView,
      meta: {
        adminLayout: true,
        requiresAdmin: true,
      },
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
    authState.isAdminAuthorized.value,
    to.meta.requiresAdmin === true,
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

function getAuthenticatedNavigationRedirect(
  toPath: string,
  isPublic: boolean,
  hasAirline: boolean,
  isAdminAuthorized: boolean,
  requiresAdmin: boolean,
): boolean | string {
  if (requiresAdmin) {
    return isAdminAuthorized ? true : playerStartPath(hasAirline);
  }

  if (isPublic) {
    return isAdminAuthorized && !hasAirline ? "/admin" : playerStartPath(hasAirline);
  }

  const isOnboardingRoute = toPath === "/onboarding/airline";
  if (isAdminAuthorized && !hasAirline) {
    return "/admin";
  }
  if (!hasAirline) {
    return isOnboardingRoute ? true : "/onboarding/airline";
  }

  if (isOnboardingRoute) {
    return defaultRoutePath;
  }

  return checkMfeRedirect(toPath);
}

function getNavigationRedirect(
  toPath: string,
  fullPath: string,
  isPublic: boolean,
  isAuthenticated: boolean,
  isRestoringSession: boolean,
  hasAirline: boolean,
  isAdminAuthorized: boolean,
  requiresAdmin: boolean,
): boolean | string | { path: string; query: { redirect: string } } {
  if (!isAuthenticated) {
    return isPublic ? true : { path: "/login", query: { redirect: fullPath } };
  }

  if (isRestoringSession) {
    return true;
  }

  return getAuthenticatedNavigationRedirect(
    toPath,
    isPublic,
    hasAirline,
    isAdminAuthorized,
    requiresAdmin,
  );
}

function playerStartPath(hasAirline: boolean): string {
  return hasAirline ? defaultRoutePath : "/onboarding/airline";
}
