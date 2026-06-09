<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { ScheduleDragState, TimelineBar } from "./schedule-types";

import { useUtcOffset } from "../composables/useUtcOffset";
import { type DaySegment, splitIntoDaySegments, timeToHour } from "./schedule-bars";

type PositionedTimelineBar = TimelineBar & {
  row: number;
};

const props = defineProps<{
  armed: boolean;
  dayLabel: (day: number) => string;
  drag: ScheduleDragState;
  placements: { bars: TimelineBar[]; day: number }[];
  t: (key: FleetMessageKey | string) => string;
  timezone?: string;
}>();

const emit = defineEmits<{
  "bar-pointer-down": [barId: string, event: PointerEvent];
  place: [day: number, time: string];
  remove: [barId: string];
}>();

const hourMarks = [0, 3, 6, 9, 12, 15, 18, 21];
const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

// --- UTC offset computation ---
// Positive = hub is ahead of UTC (e.g. Moscow = +3).
// We need this to shift local-time bars to UTC display positions.
const utcOffsetHours = computed(() => {
  const tz = props.timezone;
  if (!tz) {return 0;}
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      minute: "numeric",
      timeZone: tz,
    }).formatToParts(now);
    const localH = (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24)
      + Number(parts.find((p) => p.type === "minute")?.value ?? 0) / 60;
    const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
    let diff = localH - utcH;
    // Normalise to [-12, +12]
    if (diff > 12) {diff -= 24;}
    if (diff < -12) {diff += 24;}
    return diff;
  } catch {
    return 0;
  }
});

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

/**
 * Click on track: position is UTC; convert to local time before emitting.
 */
function onTrackClick(event: MouseEvent, utcDay: number): void {
  if (!props.armed || props.drag.active) {return;}
  const utcTime = timeFromPointer(event.clientX, event.currentTarget as HTMLElement);
  const { day, time } = utcToLocal(utcDay, utcTime);
  emit("place", day, time);
}

/** Dashed outbound drop-preview, split across UTC midnight so it wraps like a placed bar. */
function outboundPreviewSegments(day: number): DaySegment[] {
  if (!props.drag.active || props.drag.hoverDay === null || !props.drag.hoverTime) {return [];}
  const widthHours = (Math.max(props.drag.previewWidthPct, 4) / 100) * 24;
  return splitIntoDaySegments(timeToHour(props.drag.hoverTime), widthHours, props.drag.hoverDay)
    .filter((seg) => seg.day === day);
}

/**
 * Collect bars for a given UTC-day row. Bars are already built on the UTC axis
 * (local→UTC conversion + day-boundary wrapping happen in buildBlockBars), so we
 * just pick the placements grouped under this day.
 */
function rawBarsForDay(utcDay: number): TimelineBar[] {
  return props.placements.find((p) => p.day === utcDay)?.bars ?? [];
}

/** Dashed return-leg drop-preview, likewise wrapped across UTC midnight. */
function returnPreviewSegments(day: number): DaySegment[] {
  if (!props.drag.active || props.drag.returnPreviewDay === null || props.drag.returnPreviewLeftPct === null) {return [];}
  const widthHours = (Math.max(props.drag.previewWidthPct, 4) / 100) * 24;
  const startHour = (props.drag.returnPreviewLeftPct / 100) * 24;
  return splitIntoDaySegments(startHour, widthHours, props.drag.returnPreviewDay)
    .filter((seg) => seg.day === day);
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

/**
 * Convert a UTC time string + UTC day to local departure time & day.
 * Used when the user clicks or drops on the (UTC) timeline.
 */
function utcToLocal(utcDay: number, utcTime: string): { day: number; time: string } {
  const offset = utcOffsetHours.value;
  if (offset === 0) {return { day: utcDay, time: utcTime };}
  const [h = "0", m = "0"] = utcTime.split(":");
  const localHours = Number(h) + Number(m) / 60 + offset;
  let adjustedHours = localHours;
  let dayAdjust = 0;
  if (localHours < 0) { adjustedHours += 24; dayAdjust = -1; }
  else if (localHours >= 24) { adjustedHours -= 24; dayAdjust = 1; }
  const whole = Math.floor(adjustedHours);
  const time = `${String(whole).padStart(2, "0")}:${adjustedHours - whole >= 0.5 ? "30" : "00"}`;
  return { day: (utcDay + dayAdjust + 7) % 7, time };
}

const hoverActive = ref(false);
const hoverDay = ref<null | number>(null);
const hoverX = ref(0);
const hoverTimeStr = ref("");

function onTrackMouseLeave(): void {
  hoverActive.value = false;
  hoverDay.value = null;
}

function onTrackMouseMove(event: MouseEvent, day: number): void {
  const track = event.currentTarget as HTMLElement;
  const rect = track.getBoundingClientRect();
  const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
  const boundedRatio = Math.max(0, Math.min(1, ratio));
  hoverX.value = boundedRatio * 100;

  const hour = Math.max(0, Math.min(23.5, Math.round(boundedRatio * 24 * 2) / 2));
  const whole = Math.floor(hour);
  hoverTimeStr.value = `${String(whole).padStart(2, "0")}:${hour - whole >= 0.5 ? "30" : "00"}`;
  hoverDay.value = day;
  hoverActive.value = true;
}

const currentDay = ref<null | number>(null);
const currentPct = ref<null | number>(null);

// Current time is always UTC — x-axis is UTC
function updateCurrentTime(): void {
  const now = new Date();
  currentDay.value = now.getUTCDay();
  currentPct.value = ((now.getUTCHours() + now.getUTCMinutes() / 60) / 24) * 100;
}

let timer: null | ReturnType<typeof setInterval> = null;

onMounted(() => {
  updateCurrentTime();
  timer = setInterval(updateCurrentTime, 30000);
});

onUnmounted(() => {
  if (timer) {clearInterval(timer);}
});

watch(() => props.timezone, () => {
  // utcOffsetHours recomputes automatically; currentTime stays UTC
});
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
        <span
          class="w-10 shrink-0 text-caption capitalize transition-colors"
          :class="day === currentDay ? 'today-label' : 'text-text-muted'"
        >
          {{ props.dayLabel(day) }}
        </span>
        <div
          class="hour-track relative flex-1 overflow-hidden rounded-md border bg-background"
          :class="[
            props.armed ? 'cursor-copy border-primary/50' : 'border-border',
            day === currentDay ? 'today-track' : ''
          ]"
          :data-day="day"
          :style="{ height: `${Math.max(36, rowCountForDay(day) * 30 + 8)}px` }"
          @click="onTrackClick($event, day)"
          @mousemove="onTrackMouseMove($event, day)"
          @mouseleave="onTrackMouseLeave"
        >
          <!-- Night curfew overlays (22:00 - 06:00) -->
          <div
            class="pointer-events-none absolute bottom-0 left-0 top-0 w-1/4 bg-neutral-950/[0.04] dark:bg-black/15"
            title="Night operations (22:00 - 06:00)"
          />
          <div
            class="pointer-events-none absolute bottom-0 left-11/12 top-0 w-1/12 bg-neutral-950/[0.04] dark:bg-black/15"
            title="Night operations (22:00 - 06:00)"
          />

          <!-- Live drop preview: outbound (wraps across UTC midnight) -->
          <div
            v-for="(seg, i) in outboundPreviewSegments(day)"
            :key="`op-${i}`"
            class="pointer-events-none absolute top-1 flex h-6 items-center rounded border-2 border-dashed px-1.5 text-[10px] font-semibold"
            :class="props.drag.valid ? 'border-primary/70 bg-primary/15 text-primary' : 'border-error/70 bg-error/10 text-error'"
            :style="{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }"
          >
            <span v-if="seg.wrapped" class="mr-0.5 shrink-0 opacity-80" title="+1 day">↵</span>
            <span class="truncate">{{ props.drag.hoverTime }}</span>
          </div>

          <!-- Live drop preview: return leg (wraps across UTC midnight) -->
          <div
            v-for="(seg, i) in returnPreviewSegments(day)"
            :key="`rp-${i}`"
            class="pointer-events-none absolute top-1 flex h-6 items-center rounded border-2 border-dashed px-1.5 text-[10px] font-semibold"
            :class="props.drag.valid ? 'border-success/70 bg-success-bg/30 text-success' : 'border-error/70 bg-error/10 text-error'"
            :style="{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }"
          >
            <span v-if="seg.wrapped" class="mr-0.5 shrink-0 opacity-80" title="+1 day">↵</span>
            <span class="truncate">↩ R</span>
          </div>

          <!-- Thin current-time line on every row (hub local time) -->
          <div
            v-if="currentPct !== null"
            class="now-line pointer-events-none absolute bottom-0 top-0"
            :style="{
              left: `${currentPct}%`,
              backgroundColor: day === currentDay ? 'var(--state-error)' : 'rgba(185,28,28,0.18)',
              zIndex: 20,
            }"
          >
            <div v-if="day === currentDay" class="current-time-dot absolute top-0" />
          </div>

          <!-- Time hover guide line -->
          <div
            v-if="hoverActive && hoverDay === day && !props.drag.active"
            class="pointer-events-none absolute bottom-0 top-0 w-px border-l border-dashed border-primary/40"
            :style="{ left: `${hoverX}%` }"
          />

          <!-- Time hover floating badge -->
          <div
            v-if="hoverActive && hoverDay === day && !props.drag.active"
            class="hover-badge pointer-events-none absolute top-0.5 z-10 -translate-x-1/2 rounded px-1 py-0.5 text-[9px] shadow-md backdrop-blur-xs"
            :style="{ left: `${hoverX}%` }"
          >
            {{ hoverTimeStr }}
          </div>

          <div
            v-for="bar in barsForDay(day)"
            :key="bar.id"
            class="group absolute flex h-6 cursor-grab touch-none select-none items-center overflow-hidden rounded px-2 text-[10px] font-semibold shadow-xs transition-opacity duration-150 active:cursor-grabbing"
            :class="[
              bar.tone === 'return' ? 'bg-success-bg text-success border border-success/20' : 'bg-primary-soft text-on-primary-soft border border-primary/20',
              !bar.saved ? 'border-dashed' : 'border-solid',
              props.drag.active && props.drag.kind === 'block' && bar.id.startsWith(props.drag.payloadId) ? 'opacity-40' : 'hover:opacity-95',
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
              class="remove-btn"
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
    <p class="mt-0.5 text-[10px] text-text-muted opacity-70">
      {{ props.t("operations.timeline.tz") }}
    </p>
  </div>
</template>

<style scoped>
.hour-track {
  background-image: 
    repeating-linear-gradient(
      to right,
      transparent,
      transparent calc(100% / 8 - 1px),
      rgba(148, 163, 184, 0.22) calc(100% / 8 - 1px),
      rgba(148, 163, 184, 0.22) calc(100% / 8),
      transparent calc(100% / 8)
    ),
    repeating-linear-gradient(
      to right,
      transparent,
      transparent calc(100% / 24 - 1px),
      rgba(148, 163, 184, 0.08) calc(100% / 24)
    );
}

.hover-badge {
  background-color: rgba(23, 23, 23, 0.95) !important;
  color: #ffffff !important;
  font-weight: 700;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -1px rgba(0, 0, 0, 0.1);
}

.remove-btn {
  position: absolute !important;
  right: 2px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  display: grid !important;
  place-items: center !important;
  width: 16px !important;
  height: 16px !important;
  border-radius: 4px !important;
  background-color: rgba(239, 68, 68, 0.15) !important;
  color: #ef4444 !important;
  font-size: 10px !important;
  line-height: 1 !important;
  opacity: 0 !important;
  transition: opacity 150ms ease, background-color 150ms ease, color 150ms ease !important;
}

.group:hover .remove-btn {
  opacity: 1 !important;
}

.remove-btn:hover {
  background-color: #ef4444 !important;
  color: #ffffff !important;
}

.now-line {
  width: 1px;
}

.today-label {
  color: var(--primary) !important;
  font-weight: 600 !important;
}

.today-track {
  border-color: var(--primary) !important;
  box-shadow: 0 0 0 1px var(--primary) !important;
}

.current-time-dot {
  width: 6px;
  height: 6px;
  background-color: var(--state-error);
  left: 50%;
  border-radius: 50%;
  transform: translate(-50%, -2px);
  box-shadow: 0 0 4px var(--state-error);
}
</style>
