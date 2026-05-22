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
  "flight:selected": {
    flightId: string;
    source: "fleet-ops" | "map" | "shell";
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
  "shell:panel-requested": {
    panel: "flight-details" | "notifications" | "profile";
    payload?: Record<string, unknown>;
  };
};

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
