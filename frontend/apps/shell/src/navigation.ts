import type { RemoteId } from "@airlinesim/event-bus";
import type { Component } from "vue";

import {
  Banknote,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Home,
  Map,
  Plane,
  PlaneTakeoff,
  RadioTower,
  Route,
  Settings,
  ShieldCheck,
  Users,
  Wrench,
} from "@lucide/vue";

import type { ShellStatusSummary } from "./dashboard/types";
import type { ShellMessageKey } from "./i18n/messages";

import { resolveRemoteId } from "./mfe-routing";

export type NavigationChild = {
  enabled?: boolean;
  label: string;
  path: string;
};

export type NavigationSection = {
  children?: NavigationChild[];
  icon: Component;
  label: string;
  path: string;
  remoteId?: RemoteId;
};

export type StatusMetric = {
  icon: Component;
  label: string;
  value: string;
};

export const navigationSections: NavigationSection[] = [
  {
    icon: Home,
    label: "Dashboard",
    path: "/dashboard",
    remoteId: "map",
  },
  {
    children: [
      { label: "Overview", path: "/fleet/overview" },
      { label: "Aircraft", path: "/fleet/aircraft" },
      { enabled: false, label: "Orders", path: "/fleet/orders" },
      { enabled: false, label: "Configurations", path: "/fleet/configurations" },
      { enabled: false, label: "Maintenance", path: "/fleet/maintenance" },
    ],
    icon: Plane,
    label: "Fleet",
    path: "/fleet",
    remoteId: "fleet-ops",
  },
  {
    children: [
      { enabled: false, label: "My Hubs", path: "/airports/hubs" },
      { label: "Routes", path: "/airports/routes" },
      { enabled: false, label: "Fees & Slots", path: "/airports/fees-slots" },
      { enabled: false, label: "Contracts", path: "/airports/contracts" },
    ],
    icon: Map,
    label: "Airports",
    path: "/airports",
    remoteId: "network-planner",
  },
  {
    children: [
      { label: "Live flights", path: "/operations/live-flights" },
      { label: "Schedule", path: "/operations/schedule" },
      { enabled: false, label: "Fuel", path: "/operations/fuel" },
      { enabled: false, label: "Ground services", path: "/operations/ground-services" },
      { enabled: false, label: "R&D", path: "/operations/research" },
    ],
    icon: Gauge,
    label: "Operations",
    path: "/operations",
    remoteId: "fleet-ops",
  },
  {
    children: [
      { label: "Overview", path: "/finances/overview" },
      { label: "R&F profit", path: "/finances/profit" },
      { label: "Costs", path: "/finances/costs" },
      { enabled: false, label: "Loans & leasing", path: "/finances/loans-leasing" },
      { enabled: false, label: "Stock market", path: "/finances/stock-market" },
    ],
    icon: CircleDollarSign,
    label: "Finances",
    path: "/finances",
    remoteId: "finance-stock",
  },
  {
    children: [
      { label: "Overview", path: "/staff/overview" },
      { enabled: false, label: "Crew", path: "/staff/crew" },
      { enabled: false, label: "Ground staff", path: "/staff/ground-staff" },
      { enabled: false, label: "Rosters", path: "/staff/rosters" },
      { enabled: false, label: "Training", path: "/staff/training" },
    ],
    icon: Users,
    label: "Staff",
    path: "/staff",
    remoteId: "hr-facilities",
  },
  {
    children: [
      { enabled: false, label: "Company", path: "/settings/company" },
      { enabled: false, label: "Access", path: "/settings/access" },
      { enabled: false, label: "Notifications", path: "/settings/notifications" },
      { label: "System", path: "/settings/system" },
    ],
    icon: Settings,
    label: "Settings",
    path: "/settings",
    remoteId: "events-news",
  },
  {
    children: [
      { label: "Countries", path: "/admin/countries" },
      { label: "Regions", path: "/admin/regions" },
      { label: "Airports", path: "/admin/airports" },
      { label: "Region links", path: "/admin/region-links" },
      { label: "World data import", path: "/admin/import" },
      { enabled: false, label: "To be enabled", path: "/admin/future" },
    ],
    icon: ShieldCheck,
    label: "Admin",
    path: "/admin",
  },
];

export function getStatusMetrics(
  t: (key: ShellMessageKey) => string,
  status: null | ShellStatusSummary,
): StatusMetric[] {
  return [
    {
      icon: CircleDollarSign,
      label: t("status.account"),
      value: status ? formatMoney(status.balance) : "-",
    },
    {
      icon: PlaneTakeoff,
      label: t("status.planes"),
      value: status ? String(status.aircraft) : "-",
    },
    {
      icon: Bell,
      label: t("status.alerts"),
      value: status ? String(status.alerts) : "-",
    },
  ];
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en", {
    currency: "USD",
    maximumFractionDigits: 0,
    notation: value >= 1_000_000 ? "compact" : "standard",
    style: "currency",
  }).format(value);
}

export const quickActions = [
  { icon: RadioTower, label: "Live ops" },
  { icon: CalendarDays, label: "Schedule" },
  { icon: ClipboardList, label: "Reports" },
  { icon: Building2, label: "Facilities" },
  { icon: Banknote, label: "Finance" },
  { icon: BriefcaseBusiness, label: "Contracts" },
  { icon: ShieldCheck, label: "Safety" },
  { icon: Wrench, label: "Maintenance" },
  { icon: Route, label: "Routes" },
];

export function getRemoteIdByPath(path: string): RemoteId | undefined {
  return resolveRemoteId(path);
}
