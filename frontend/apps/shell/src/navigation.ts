import type { RemoteId } from "@airlinesim/event-bus";
import type { Component } from "vue";

import {
  Banknote,
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

import { resolveRemoteId } from "./mfe-routing";

export type NavigationChild = {
  label: string;
  path: string;
};

export type NavigationSection = {
  children?: NavigationChild[];
  icon: Component;
  label: string;
  path: string;
  remoteId: RemoteId;
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
      { label: "Orders", path: "/fleet/orders" },
      { label: "Configurations", path: "/fleet/configurations" },
      { label: "Maintenance", path: "/fleet/maintenance" },
    ],
    icon: Plane,
    label: "Fleet",
    path: "/fleet",
    remoteId: "fleet-ops",
  },
  {
    children: [
      { label: "My Hubs", path: "/airports/hubs" },
      { label: "Routes", path: "/airports/routes" },
      { label: "Fees & Slots", path: "/airports/fees-slots" },
      { label: "Contracts", path: "/airports/contracts" },
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
      { label: "Ground services", path: "/operations/ground-services" },
      { label: "R&D", path: "/operations/research" },
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
      { label: "Loans & leasing", path: "/finances/loans-leasing" },
      { label: "Stock market", path: "/finances/stock-market" },
    ],
    icon: CircleDollarSign,
    label: "Finances",
    path: "/finances",
    remoteId: "finance-stock",
  },
  {
    children: [
      { label: "Overview", path: "/staff/overview" },
      { label: "Crew", path: "/staff/crew" },
      { label: "Ground staff", path: "/staff/ground-staff" },
      { label: "Rosters", path: "/staff/rosters" },
      { label: "Training", path: "/staff/training" },
    ],
    icon: Users,
    label: "Staff",
    path: "/staff",
    remoteId: "hr-facilities",
  },
  {
    children: [
      { label: "Company", path: "/settings/company" },
      { label: "Access", path: "/settings/access" },
      { label: "Notifications", path: "/settings/notifications" },
    ],
    icon: Settings,
    label: "Settings",
    path: "/settings",
    remoteId: "events-news",
  },
];

export const statusMetrics = [
  {
    icon: CircleDollarSign,
    label: "Account",
    value: "$50,000,000",
  },
  {
    icon: Fuel,
    label: "Fuel",
    value: "30,000 t",
  },
  {
    icon: PlaneTakeoff,
    label: "Planes",
    value: "122",
  },
];

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
