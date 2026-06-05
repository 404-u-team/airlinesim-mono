import type { RemoteId } from "@airlinesim/event-bus";
import type { Component } from "vue";

import {
  Banknote,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Fuel,
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
import type { FuelPriceSnapshot } from "./fuel/types";
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
      { label: "Feed", path: "/events/feed" },
      { label: "Notifications", path: "/events/notifications" },
    ],
    icon: Bell,
    label: "Events",
    path: "/events",
    remoteId: "events-news",
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
      { label: "Fuel", path: "/operations/fuel" },
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
    label: "Base & Facilities",
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
  },
  {
    icon: BookOpen,
    label: "Knowledge Base",
    path: "/knowledge-base",
  },
];

export function getStatusMetrics(
  t: (key: ShellMessageKey) => string,
  status: null | ShellStatusSummary,
  fuel: FuelPriceSnapshot | null = null,
  locale = "en",
): StatusMetric[] {
  return [
    {
      icon: CircleDollarSign,
      label: t("status.account"),
      value: status ? formatMoney(status.balance, locale) : "-",
    },
    {
      icon: Fuel,
      label: t("status.fuel"),
      value: fuel ? formatMoney(fuel.unit_price, locale) : "-",
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

function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
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
