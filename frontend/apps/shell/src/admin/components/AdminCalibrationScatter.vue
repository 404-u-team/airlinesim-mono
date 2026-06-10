<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";

import type { ScorecardRow } from "../types";

const props = defineProps<{ appLocale: Locale; scorecard: ScorecardRow[] }>();
const ru = computed(() => props.appLocale === "ru");

// Log-log scatter of real vs model daily pax. Diagonal = perfect; above = model
// over-predicts, below = under-predicts. Axes span 1..10000 pax/day (log10 0..4).
const W = 320;
const H = 320;
const PAD = 28;
const LO = 0; // log10(1)
const HI = 4; // log10(10000)

function sx(real: number): number {
  const l = Math.max(LO, Math.min(HI, Math.log10(Math.max(1, real))));
  return PAD + ((l - LO) / (HI - LO)) * (W - 2 * PAD);
}
function sy(model: number): number {
  const l = Math.max(LO, Math.min(HI, Math.log10(Math.max(1, model))));
  return H - PAD - ((l - LO) / (HI - LO)) * (H - 2 * PAD);
}

const points = computed(() => props.scorecard.map((r) => ({ x: sx(r.realDailyPax), y: sy(r.modelDailyPax) })));
const ticks = [1, 10, 100, 1000, 10000];

const ranked = computed(() => props.scorecard.map((r) => ({ ...r, ratio: r.modelDailyPax / Math.max(1, r.realDailyPax) })));
const topOver = computed(() => [...ranked.value].sort((a, b) => b.ratio - a.ratio).slice(0, 8));
const topUnder = computed(() => [...ranked.value].sort((a, b) => a.ratio - b.ratio).slice(0, 8));
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-[340px_1fr]">
    <figure class="rounded-md border border-border p-2 text-text-muted">
      <svg :viewBox="`0 0 ${W} ${H}`" class="w-full">
        <!-- diagonal y = x (perfect prediction) -->
        <line
          :x1="sx(1)"
          :y1="sy(1)"
          :x2="sx(10000)"
          :y2="sy(10000)"
          stroke="currentColor"
          stroke-dasharray="4 3"
          opacity="0.5"
        />
        <!-- axes ticks -->
        <template v-for="t in ticks" :key="t">
          <text
            :x="sx(t)"
            :y="H - 8"
            font-size="9"
            text-anchor="middle"
            fill="currentColor"
            opacity="0.7"
          >{{ t }}</text>
          <text
            :x="8"
            :y="sy(t) + 3"
            font-size="9"
            text-anchor="start"
            fill="currentColor"
            opacity="0.7"
          >{{ t }}</text>
        </template>
        <text
          :x="W / 2"
          :y="H - 0.5"
          font-size="9"
          text-anchor="middle"
          fill="currentColor"
          opacity="0.8"
        >real pax/day</text>
        <circle
          v-for="(p, i) in points"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          r="1.5"
          fill="var(--color-primary, #4f80ff)"
          opacity="0.35"
        />
      </svg>
      <figcaption class="px-2 pb-1 text-caption">
        {{ ru ? 'Точка выше диагонали — модель завышает, ниже — занижает (log–log).' : 'Above the diagonal = model over-predicts, below = under (log–log).' }}
      </figcaption>
    </figure>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-md border border-border overflow-hidden">
        <div class="bg-surface-subtle px-3 py-2 text-caption font-semibold uppercase text-warning">
          {{ ru ? 'Сильнее всего завышены' : 'Top over-predicted' }}
        </div>
        <table class="w-full text-caption">
          <tbody>
            <tr v-for="r in topOver" :key="r.originIata + r.destIata" class="border-b border-border last:border-0">
              <td class="px-3 py-1">
                {{ r.originIata }}–{{ r.destIata }}
              </td>
              <td class="px-2 py-1 text-right font-mono text-text-muted">
                {{ r.realDailyPax }}→{{ r.modelDailyPax }}
              </td>
              <td class="px-2 py-1 text-right font-mono font-semibold text-warning">
                ×{{ r.ratio.toFixed(1) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="rounded-md border border-border overflow-hidden">
        <div class="bg-surface-subtle px-3 py-2 text-caption font-semibold uppercase text-primary">
          {{ ru ? 'Сильнее всего занижены' : 'Top under-predicted' }}
        </div>
        <table class="w-full text-caption">
          <tbody>
            <tr v-for="r in topUnder" :key="r.originIata + r.destIata" class="border-b border-border last:border-0">
              <td class="px-3 py-1">
                {{ r.originIata }}–{{ r.destIata }}
              </td>
              <td class="px-2 py-1 text-right font-mono text-text-muted">
                {{ r.realDailyPax }}→{{ r.modelDailyPax }}
              </td>
              <td class="px-2 py-1 text-right font-mono font-semibold text-primary">
                ×{{ r.ratio.toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
