<script setup lang="ts">
import type { FleetMessageKey } from "../i18n";
import type { ScheduleDragState, TimelineBar } from "./schedule-types";

type PositionedTimelineBar = TimelineBar & {
  row: number;
};

const props = defineProps<{
  armed: boolean;
  dayLabel: (day: number) => string;
  drag: ScheduleDragState;
  placements: { bars: TimelineBar[]; day: number }[];
  t: (key: FleetMessageKey | string) => string;
}>();

const emit = defineEmits<{
  "bar-pointer-down": [barId: string, event: PointerEvent];
  place: [day: number, time: string];
  remove: [barId: string];
}>();

const hourMarks = [0, 3, 6, 9, 12, 15, 18, 21];
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

function barEndPct(bar: TimelineBar): number {
  return Math.min(100, bar.leftPct + Math.max(bar.widthPct, 3));
}

function barsForDay(day: number): PositionedTimelineBar[] {
  const rows: TimelineBar[][] = [];
  const bars = [...rawBarsForDay(day)].sort((left, right) => left.leftPct - right.leftPct);

  return bars.map((bar) => {
    const targetRow = findAvailableRow(rows, bar);

    rows[targetRow] = [...(rows[targetRow] ?? []), bar];
    return { ...bar, row: targetRow };
  });
}

function findAvailableRow(rows: TimelineBar[][], bar: TimelineBar): number {
  const row = rows.findIndex((items) => !items.some((item) => isOverlapping(item, bar)));

  return row === -1 ? rows.length : row;
}

function isOverlapping(left: TimelineBar, right: TimelineBar): boolean {
  return left.leftPct < barEndPct(right) && right.leftPct < barEndPct(left);
}

function onTrackClick(event: MouseEvent, day: number): void {
  if (!props.armed || props.drag.active) {
    return;
  }

  emit("place", day, timeFromPointer(event.clientX, event.currentTarget as HTMLElement));
}

function previewLeftPct(time: string): number {
  const [hour = "9", minute = "0"] = time.split(":");

  return ((Number(hour) + Number(minute) / 60) / 24) * 100;
}

function rawBarsForDay(day: number): TimelineBar[] {
  return props.placements.find((placement) => placement.day === day)?.bars ?? [];
}

function rowCountForDay(day: number): number {
  return Math.max(1, ...barsForDay(day).map((bar) => bar.row + 1));
}

function timeFromPointer(clientX: number, track: HTMLElement): string {
  const rect = track.getBoundingClientRect();
  const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const hour = Math.max(0, Math.min(23.5, Math.round(ratio * 24 * 2) / 2));
  const whole = Math.floor(hour);

  return `${String(whole).padStart(2, "0")}:${hour - whole >= 0.5 ? "30" : "00"}`;
}
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-3">
    <div class="flex items-center gap-2 pl-12 text-[10px] text-text-muted">
      <div class="relative h-4 flex-1">
        <span
          v-for="mark in hourMarks"
          :key="mark"
          class="absolute -translate-x-1/2"
          :style="{ left: `${(mark / 24) * 100}%` }"
        >
          {{ String(mark).padStart(2, "0") }}
        </span>
      </div>
    </div>

    <div class="mt-1 grid gap-1">
      <div
        v-for="day in weekdayOrder"
        :key="day"
        class="flex items-center gap-2"
      >
        <span class="w-10 shrink-0 text-caption capitalize text-text-muted">{{ props.dayLabel(day) }}</span>
        <div
          class="hour-track relative flex-1 overflow-hidden rounded-md border border-border bg-background"
          :class="props.armed ? 'cursor-copy border-primary/50' : ''"
          :data-day="day"
          :style="{ height: `${Math.max(36, rowCountForDay(day) * 30 + 8)}px` }"
          @click="onTrackClick($event, day)"
        >
          <!-- Live drop preview while dragging -->
          <div
            v-if="props.drag.active && props.drag.hoverDay === day && props.drag.hoverTime"
            class="pointer-events-none absolute top-1 flex h-6 items-center rounded border-2 border-dashed px-1.5 text-[10px] font-semibold"
            :class="props.drag.valid ? 'border-primary/70 bg-primary/15 text-primary' : 'border-error/70 bg-error/10 text-error'"
            :style="{ left: `${previewLeftPct(props.drag.hoverTime)}%`, width: `${Math.max(props.drag.previewWidthPct, 4)}%` }"
          >
            <span class="truncate">{{ props.drag.hoverTime }}</span>
          </div>

          <div
            v-for="bar in barsForDay(day)"
            :key="bar.id"
            class="group absolute flex h-6 cursor-grab touch-none select-none items-center overflow-hidden rounded pl-1.5 pr-5 text-[10px] font-semibold shadow-sm active:cursor-grabbing"
            :class="[
              bar.tone === 'return' ? 'bg-success text-white' : 'bg-primary text-on-primary',
              props.drag.active && props.drag.kind === 'block' && bar.id.startsWith(props.drag.payloadId) ? 'opacity-40' : '',
            ]"
            :style="{ left: `${bar.leftPct}%`, top: `${4 + bar.row * 30}px`, width: `${Math.max(bar.widthPct, 4)}%` }"
            :title="bar.label"
            @pointerdown="emit('bar-pointer-down', bar.id, $event)"
          >
            <span
              v-if="bar.wrapped"
              class="mr-0.5 shrink-0 opacity-80"
              title="+1 day"
            >↵</span>
            <span class="truncate">{{ bar.label }}</span>
            <button
              class="absolute right-0.5 top-1/2 grid size-4 -translate-y-1/2 place-items-center rounded-sm bg-black/15 text-[11px] leading-none opacity-0 transition group-hover:opacity-100 hover:bg-black/30"
              type="button"
              :aria-label="props.t('action.remove')"
              @pointerdown.stop
              @click.stop="emit('remove', bar.id)"
            >
              ×
            </button>
          </div>
        </div>
      </div>
    </div>

    <p class="mt-2 text-caption text-text-muted">
      {{ props.t("operations.timeline.hint") }}
    </p>
  </div>
</template>

<style scoped>
.hour-track {
  background-image: repeating-linear-gradient(
    to right,
    transparent,
    transparent calc(100% / 24 - 1px),
    rgba(148, 163, 184, 0.18) calc(100% / 24)
  );
}
</style>
