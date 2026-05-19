import { createRouter, createWebHistory } from "vue-router";

import { defaultRoutePath, navigationSections } from "./navigation";
import ShellRemoteView from "./views/ShellRemoteView.vue";

const navigationRoutes = navigationSections.flatMap((section) => [
  {
    component: ShellRemoteView,
    meta: {
      remoteId: section.remoteId,
    },
    path: section.path,
  },
  ...(section.children ?? []).map((child) => ({
    component: ShellRemoteView,
    meta: {
      remoteId: section.remoteId,
    },
    path: child.path,
  })),
]);

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: defaultRoutePath,
    },
    ...navigationRoutes,
    {
      path: "/:pathMatch(.*)*",
      redirect: defaultRoutePath,
    },
  ],
});
