import { createRouter, createWebHistory } from "vue-router";

import { authState } from "./auth";
import { createMfeRouteRecords, defaultRoutePath, resolveMfeRoute } from "./mfe-routing";
import AuthView from "./views/AuthView.vue";
import ShellRemoteView from "./views/ShellRemoteView.vue";

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
    ...createMfeRouteRecords(ShellRemoteView),
    {
      path: "/:pathMatch(.*)*",
      redirect: defaultRoutePath,
    },
  ],
});

router.beforeEach((to) => {
  const isPublic = to.meta.public === true;

  if (!isPublic && !authState.isAuthenticated.value) {
    return {
      path: "/login",
      query: {
        redirect: to.fullPath,
      },
    };
  }

  if (isPublic && authState.isAuthenticated.value) {
    return defaultRoutePath;
  }

  const mfeRoute = resolveMfeRoute(to.path);

  if (mfeRoute?.defaultPath !== mfeRoute?.pathPrefix && to.path === mfeRoute?.pathPrefix) {
    return mfeRoute.defaultPath;
  }

  return true;
});
