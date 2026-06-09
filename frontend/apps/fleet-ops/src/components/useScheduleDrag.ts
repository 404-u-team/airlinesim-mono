import { onUnmounted, reactive, type Ref } from "vue";

import type { ScheduleDragState } from "./schedule-types";

import { timeToHour } from "./schedule-bars";

export type ScheduleBlock = { day: number; id: string; routeId: string; saved?: boolean; time: string };

type DragContext = {
  drag: ScheduleDragState;
  onEnd: () => void;
  onMove: (event: PointerEvent) => void;
  options: DragOptions;
};

type DragOptions = {
  blocks: Ref<ScheduleBlock[]>;
  hasConflict: (candidate: ScheduleBlock, ignoredBlockId?: string) => boolean;
  moveBlock: (blockId: string, day: number, time: string) => void;
  placeBlock: (day: number, time: string, routeId?: string) => void;
  previewWidthForRoute: (routeId: string) => number;
  /** Total block-hours for the route (one-way, excluding turnaround) */
  routeHoursForRoute: (routeId: string) => number;
  routeLabel: (routeId: string) => string;
  setArmedRoute: (routeId: string) => void;
  turnaroundHours: number;
  /** UTC offset of the hub airport in hours (e.g. +3 for Moscow). Used to convert UTC drag position to local departure time. */
  utcOffsetHours?: number;
};

/**
 * Pointer-based drag controller shared by the route palette and the timeline.
 * Native HTML5 drag is avoided because its system drag-image is clipped; here the floating
 * ghost is rendered in-DOM by the host component from the returned reactive `drag` state.
 */
export function useScheduleDrag(options: DragOptions): {
  drag: ScheduleDragState;
  onBarPointerDown: (barId: string, event: PointerEvent) => void;
  startRouteDrag: (routeId: string, event: PointerEvent) => void;
} {
  const drag = reactive<ScheduleDragState>({
    active: false,
    hoverDay: null,
    hoverTime: null,
    kind: null,
    label: "",
    localDay: null,
    localTime: null,
    payloadId: "",
    previewWidthPct: 0,
    returnPreviewDay: null,
    returnPreviewLeftPct: null,
    tone: "outbound",
    valid: false,
    x: 0,
    y: 0,
  });
  const context: DragContext = {
    drag,
    onEnd: () => handleEnd(context),
    onMove: (event) => handleMove(context, event),
    options,
  };

  onUnmounted(() => detach(context));

  return {
    drag,
    onBarPointerDown(barId, event) {
      const blockId = barId.replace(/(~r)?@\d+$/, "").replace(/~r$/, "");
      const block = options.blocks.value.find((item) => item.id === blockId);

      if (block) {
        begin(context, "block", blockId, block.routeId, event);
      }
    },
    startRouteDrag(routeId, event) {
      options.setArmedRoute(routeId);
      begin(context, "route", routeId, routeId, event);
    },
  };
}

function attach(context: DragContext): void {
  window.addEventListener("pointermove", context.onMove);
  window.addEventListener("pointerup", context.onEnd);
  window.addEventListener("pointercancel", context.onEnd);
}

function begin(context: DragContext, kind: "block" | "route", payloadId: string, routeId: string, event: PointerEvent): void {
  const { drag, options } = context;

  event.preventDefault();
  drag.active = true;
  drag.kind = kind;
  drag.payloadId = payloadId;
  drag.label = options.routeLabel(routeId);
  drag.previewWidthPct = options.previewWidthForRoute(routeId);
  drag.tone = "outbound";
  drag.hoverDay = null;
  drag.hoverTime = null;
  drag.valid = false;
  drag.x = event.clientX;
  drag.y = event.clientY;
  attach(context);
}

function convertUtcToLocal(utcDay: number, utcTime: string, offset: number): { day: number; time: string } {
  if (offset === 0) {
    return { day: utcDay, time: utcTime };
  }
  const [h = "0", m = "0"] = utcTime.split(":");
  const localH = Number(h) + Number(m) / 60 + offset;
  let adjustedH = localH;
  let dayAdj = 0;
  if (localH < 0) {
    adjustedH += 24;
    dayAdj = -1;
  } else if (localH >= 24) {
    adjustedH -= 24;
    dayAdj = 1;
  }
  const whole = Math.floor(adjustedH);
  const time = `${String(whole).padStart(2, "0")}:${adjustedH - whole >= 0.5 ? "30" : "00"}`;
  const day = (utcDay + dayAdj + 7) % 7;
  return { day, time };
}

function detach(context: DragContext): void {
  window.removeEventListener("pointermove", context.onMove);
  window.removeEventListener("pointerup", context.onEnd);
  window.removeEventListener("pointercancel", context.onEnd);
}

function handleEnd(context: DragContext): void {
  const { drag, options } = context;

  if (drag.active && drag.localDay !== null && drag.localTime && drag.valid) {
    if (drag.kind === "route") {
      options.placeBlock(drag.localDay, drag.localTime, drag.payloadId);
    } else if (drag.kind === "block") {
      options.moveBlock(drag.payloadId, drag.localDay, drag.localTime);
    }
  }
  drag.active = false;
  drag.kind = null;
  drag.hoverDay = null;
  drag.hoverTime = null;
  drag.localDay = null;
  drag.localTime = null;
  drag.returnPreviewDay = null;
  drag.returnPreviewLeftPct = null;
  detach(context);
}

function handleMove(context: DragContext, event: PointerEvent): void {
  const { drag, options } = context;

  if (!drag.active) {
    return;
  }
  drag.x = event.clientX;
  drag.y = event.clientY;

  const track = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-day]");

  if (!track) {
    drag.hoverDay = null;
    drag.hoverTime = null;
    drag.valid = false;
    return;
  }

  // timeFromPointer returns UTC time (x-axis is UTC)
  const utcDay = Number(track.dataset.day);
  const utcTime = timeFromPointer(event.clientX, track);

  // Convert UTC position to local departure time for scheduling logic
  const { day: localDay, time: localTime } = convertUtcToLocal(utcDay, utcTime, options.utcOffsetHours ?? 0);

  const existing = options.blocks.value.find((block) => block.id === drag.payloadId);
  const candidate: ScheduleBlock = drag.kind === "block" && existing
    ? { ...existing, day: localDay, time: localTime }
    : { day: localDay, id: "preview", routeId: drag.payloadId, time: localTime };

  // hoverDay/hoverTime = UTC for display in the timeline
  drag.hoverDay = utcDay;
  drag.hoverTime = utcTime;
  // localDay/localTime = what actually gets stored
  drag.localDay = localDay;
  drag.localTime = localTime;
  drag.valid = !options.hasConflict(candidate, drag.kind === "block" ? drag.payloadId : "");

  // Return-leg preview: computed in UTC (flight duration is timezone-independent)
  const routeId = drag.kind === "block"
    ? (options.blocks.value.find((b) => b.id === drag.payloadId)?.routeId ?? drag.payloadId)
    : drag.payloadId;
  const blockHours = options.routeHoursForRoute(routeId);
  const returnUTCHour = timeToHour(utcTime) + blockHours + options.turnaroundHours;
  const returnDayOffset = Math.floor(returnUTCHour / 24);
  drag.returnPreviewDay = (utcDay + returnDayOffset) % 7;
  drag.returnPreviewLeftPct = ((returnUTCHour % 24) / 24) * 100;
}

function timeFromPointer(clientX: number, track: HTMLElement): string {
  const rect = track.getBoundingClientRect();
  const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const hour = Math.max(0, Math.min(23.5, Math.round(ratio * 24 * 2) / 2));
  const whole = Math.floor(hour);

  return `${String(whole).padStart(2, "0")}:${hour - whole >= 0.5 ? "30" : "00"}`;
}
