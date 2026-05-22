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

export const mfeRoutes = [
  {
    defaultPath: "/dashboard",
    label: "Dashboard",
    pathPrefix: "/dashboard",
    remoteId: "map",
  },
  {
    defaultPath: "/fleet/overview",
    label: "Fleet",
    pathPrefix: "/fleet",
    remoteId: "fleet-ops",
  },
  {
    defaultPath: "/airports/hubs",
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
    defaultPath: "/staff/overview",
    label: "Staff",
    pathPrefix: "/staff",
    remoteId: "hr-facilities",
  },
  {
    defaultPath: "/settings/company",
    label: "Settings",
    pathPrefix: "/settings",
    remoteId: "events-news",
  },
] as const satisfies MfeRouteDefinition[];

export function createMfeRouteRecords(component: RouteComponent): RouteRecordRaw[] {
  return mfeRoutes.flatMap((route) => {
    const remoteRoute: RouteRecordRaw = {
      component,
      meta: {
        defaultPath: route.defaultPath,
        remoteId: route.remoteId,
      },
      path:
        route.pathPrefix === route.defaultPath
          ? route.pathPrefix
          : `${route.pathPrefix}/:mfePath(.*)*`,
    };

    if (route.pathPrefix === route.defaultPath) {
      return [remoteRoute];
    }

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
