import type { RemoteId } from "@airlinesim/event-bus";
import type { RouteComponent, RouteRecordRaw } from "vue-router";

export type MfeRouteDefinition = {
  defaultPath: string;
  label: string;
  pathPrefix: string;
  remoteId: RemoteId;
};

export type ResolvedMfeRoute = MfeRouteDefinition & {
  path: string;
};

export const defaultRoutePath = "/dashboard";

export const mfeRoutes: MfeRouteDefinition[] = [
  {
    defaultPath: "/fleet/overview",
    label: "Fleet",
    pathPrefix: "/fleet",
    remoteId: "fleet-ops",
  },
  {
    defaultPath: "/airports/routes",
    label: "Airports",
    pathPrefix: "/airports",
    remoteId: "network-planner",
  },
  {
    defaultPath: "/operations/live-flights",
    label: "Operations",
    pathPrefix: "/operations",
    remoteId: "fleet-ops",
  },
  {
    defaultPath: "/finances/overview",
    label: "Finances",
    pathPrefix: "/finances",
    remoteId: "finance-stock",
  },
  {
    defaultPath: "/events/feed",
    label: "Events",
    pathPrefix: "/events",
    remoteId: "events-news",
  },
  {
    defaultPath: "/staff/overview",
    label: "Base & Facilities",
    pathPrefix: "/staff",
    remoteId: "hr-facilities",
  },
] as const;

export function createMfeRouteRecords(component: RouteComponent): RouteRecordRaw[] {
  return mfeRoutes.flatMap((route) => {
    const path = `${route.pathPrefix}/:mfePath(.*)*`;
    const remoteRoute: RouteRecordRaw = {
      component,
      meta: {
        defaultPath: route.defaultPath,
        remoteId: route.remoteId,
      },
      path,
    };

    return [
      {
        path: route.pathPrefix,
        redirect: route.defaultPath,
      },
      remoteRoute,
    ];
  });
}

export function normalizeShellPath(path: string): string {
  if (!path || path === "/") {
    return defaultRoutePath;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function resolveMfeRoute(path: string): ResolvedMfeRoute | undefined {
  const normalizedPath = normalizeShellPath(path);
  const route = mfeRoutes.find(
    (mfeRoute) =>
      normalizedPath === mfeRoute.pathPrefix ||
      normalizedPath.startsWith(`${mfeRoute.pathPrefix}/`),
  );

  if (!route) {
    return undefined;
  }

  return {
    ...route,
    path: normalizedPath,
  };
}

export function resolveRemoteId(path: string): RemoteId | undefined {
  return resolveMfeRoute(path)?.remoteId;
}
