import { onUnmounted, reactive, type Ref } from "vue";

import type { ScheduleDragState } from "./schedule-types";

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
  routeLabel: (routeId: string) => string;
  setArmedRoute: (routeId: string) => void;
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
    payloadId: "",
    previewWidthPct: 0,
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

function detach(context: DragContext): void {
  window.removeEventListener("pointermove", context.onMove);
  window.removeEventListener("pointerup", context.onEnd);
  window.removeEventListener("pointercancel", context.onEnd);
}

function handleEnd(context: DragContext): void {
  const { drag, options } = context;

  if (drag.active && drag.hoverDay !== null && drag.hoverTime && drag.valid) {
    if (drag.kind === "route") {
      options.placeBlock(drag.hoverDay, drag.hoverTime, drag.payloadId);
    } else if (drag.kind === "block") {
      options.moveBlock(drag.payloadId, drag.hoverDay, drag.hoverTime);
    }
  }
  drag.active = false;
  drag.kind = null;
  drag.hoverDay = null;
  drag.hoverTime = null;
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

  const day = Number(track.dataset.day);
  const time = timeFromPointer(event.clientX, track);
  const existing = options.blocks.value.find((block) => block.id === drag.payloadId);
  const candidate: ScheduleBlock = drag.kind === "block" && existing
    ? { ...existing, day, time }
    : { day, id: "preview", routeId: drag.payloadId, time };

  drag.hoverDay = day;
  drag.hoverTime = time;
  drag.valid = !options.hasConflict(candidate, drag.kind === "block" ? drag.payloadId : "");
}

function timeFromPointer(clientX: number, track: HTMLElement): string {
  const rect = track.getBoundingClientRect();
  const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const hour = Math.max(0, Math.min(23.5, Math.round(ratio * 24 * 2) / 2));
  const whole = Math.floor(hour);

  return `${String(whole).padStart(2, "0")}:${hour - whole >= 0.5 ? "30" : "00"}`;
}
