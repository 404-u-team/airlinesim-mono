export type EventItem = {
  category: "finance" | "fleet" | "operations" | "route" | "system";
  code: string;
  id: string;
  occurred_at: string;
  parameters: Record<string, boolean | number | string>;
  severity: "danger" | "info" | "success" | "warning";
  target_path: string;
};

export type EventsResponse = {
  counts: {
    categories: Record<string, number>;
    severities: Record<string, number>;
  };
  events: EventItem[];
  generated_at: string;
  next_cursor: null | string;
};

export type NotificationItem = {
  code: string;
  id: string;
  is_read: boolean;
  last_seen_at: string;
  parameters: Record<string, boolean | number | string>;
  severity: "danger" | "info" | "success" | "warning";
  state: "active" | "ignored" | "resolved";
  target_path: string;
};

