<script setup lang="ts">
type MetricTone = "danger" | "neutral" | "success" | "warning";

withDefaults(
  defineProps<{
    hint?: string;
    label: string;
    tone?: MetricTone;
    value: string;
  }>(),
  {
    hint: undefined,
    tone: "neutral",
  },
);

const toneClasses: Record<MetricTone, string> = {
  danger: "border-error bg-error-bg text-slate-950",
  neutral: "border-border bg-surface text-text-primary",
  success: "border-success bg-success-bg text-slate-950",
  warning: "border-warning bg-warning-bg text-slate-950",
};
</script>

<template>
  <article
    class="min-w-0 rounded-lg border p-4"
    :class="toneClasses[tone]"
  >
    <p class="truncate text-caption opacity-75">
      {{ label }}
    </p>
    <p class="mt-2 truncate text-subtitle">
      {{ value }}
    </p>
    <p
      v-if="hint"
      class="mt-1 line-clamp-2 text-caption opacity-75"
    >
      {{ hint }}
    </p>
  </article>
</template>
