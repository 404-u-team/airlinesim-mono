export type ScheduleDragState = {
  active: boolean;
  hoverDay: null | number;
  hoverTime: null | string;
  kind: "block" | "route" | null;
  label: string;
  /** Local departure day (converted from UTC display position) — used for actual block storage */
  localDay: null | number;
  /** Local departure time (converted from UTC display position) — used for actual block storage */
  localTime: null | string;
  payloadId: string;
  previewWidthPct: number;
  /** Left-position (%) of the return-leg preview on returnPreviewDay */
  returnPreviewDay: null | number;
  returnPreviewLeftPct: null | number;
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
