export type Notification = {
  code: string;
  first_seen_at: string;
  id: string;
  is_read: boolean;
  last_seen_at: string;
  parameters: Record<string, boolean | number | string>;
  severity: "danger" | "info" | "success" | "warning";
  state: "active" | "resolved";
  target_path: string;
};

export type NotificationSummary = {
  active_count: number;
  danger_count: number;
  latest: Notification[];
  unread_active_count: number;
  warning_count: number;
};

