export type ReadinessIssue = {
  code: string;
  entity_id?: string;
  entity_label?: string;
  entity_type: "airport" | "country" | "product" | "region" | "region_link";
  parameters: Record<string, boolean | number | string>;
  target_path: string;
};

export type WorldReadiness = {
  blockers: ReadinessIssue[];
  checked_at: string;
  counts: {
    airports: number;
    countries: number;
    region_links: number;
    regions: number;
  };
  entity_summaries: Record<string, {
    invalid: number;
    missing: number;
    ready: number;
  }>;
  next_actions: Array<{
    code: string;
    target_path: string;
  }>;
  status: "blocked" | "ready" | "warning";
  warnings: ReadinessIssue[];
};

