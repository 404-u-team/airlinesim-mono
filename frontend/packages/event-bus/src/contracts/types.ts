export type AirlineSimEvents = {
  "auth:login-failed": {
    message: string;
  };
  "auth:login-succeeded": {
    accessToken: string;
  };
  "auth:logout": {
    reason: "expired" | "manual";
  };
  "auth:register-failed": {
    message: string;
  };
  "auth:register-succeeded": {
    accessToken: string;
  };
  "auth:session-restored": {
    accessToken: string;
  };
  "events:invalidated": {
    reason: "aircraft-purchased" | "flight-completed" | "risk-changed" | "route-created" | "schedule-activated";
    source: "events-news" | "finance-stock" | "fleet-ops" | "network-planner" | "shell";
  };
  "fleet:aircraft-purchased": {
    aircraftId?: string;
    baseAirportId?: string;
    modelName?: string;
    price?: number;
    tailNumber?: string;
    typeId?: string;
  };
  "flight:selected": {
    flightId: string;
    source: "fleet-ops" | "map" | "shell";
  };
  "game:snapshot-invalidated": {
    reason: "aircraft-purchased" | "manual-refresh" | "route-created" | "schedule-activated";
    source: "fleet-ops" | "network-planner" | "shell";
  };
  "i18n:locale-changed": {
    locale: Locale;
  };
  "map:airport-selected": {
    airportId: string;
    source: "dashboard" | "map" | "network-planner";
  };
  "map:network-refresh-requested": {
    reason: "aircraft-purchased" | "manual-refresh" | "route-created" | "schedule-activated";
    source: "fleet-ops" | "network-planner" | "shell";
  };
  "map:route-selected": {
    routeId: string;
    source: "dashboard" | "map" | "network-planner";
  };
  "mfe:ready": {
    remoteId: RemoteId;
  };
  "navigation:changed": NavigationChangedEvent;
  "navigation:intent": NavigationIntentEvent;
  "navigation:remote-selected": {
    path?: string;
    remoteId: RemoteId;
  };
  "notification:created": {
    message: string;
    severity: "error" | "info" | "success" | "warning";
  };
  "notifications:invalidated": {
    reason: "aircraft-purchased" | "flight-completed" | "read-state-changed" | "risk-changed" | "route-created" | "schedule-activated";
    source: "events-news" | "finance-stock" | "fleet-ops" | "network-planner" | "shell";
  };
  "route:created": {
    destinationAirportId: string;
    originAirportId: string;
    source: "network-planner";
  };
  "schedule:activated": {
    routeId: string;
    source: "fleet-ops";
  };
  "shell:panel-requested": {
    panel: "flight-details" | "notifications" | "profile";
    payload?: Record<string, unknown>;
  };
};

export type Locale = "en" | "ru";

export type NavigationChangedEvent = {
  fromPath?: string;
  navigationId: string;
  path: string;
  remoteId: RemoteId;
};

export type NavigationIntentEvent = {
  replace?: boolean;
  source: "mfe" | "shell";
  targetPath: string;
};

export type RemoteId =
  | "events-news"
  | "finance-stock"
  | "fleet-ops"
  | "hr-facilities"
  | "map"
  | "network-planner";
