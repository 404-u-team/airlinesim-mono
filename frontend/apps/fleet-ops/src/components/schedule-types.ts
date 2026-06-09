export type ScheduleDragState = {
  active: boolean;
  hoverDay: null | number;
  hoverTime: null | string;
  kind: "block" | "route" | null;
  label: string;
  payloadId: string;
  previewWidthPct: number;
  tone: "outbound" | "return";
  valid: boolean;
  x: number;
  y: number;
};

export type TimelineBar = {
  day: number;
  id: string;
  label: string;
  leftPct: number;
  saved?: boolean;
  tone: "outbound" | "return";
  widthPct: number;
  wrapped?: boolean;
};
