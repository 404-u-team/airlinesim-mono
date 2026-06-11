<script setup lang="ts">
type ProgressBarTone = "danger" | "neutral" | "primary" | "success" | "warning";

withDefaults(
  defineProps<{
    percent: number;
    tone?: ProgressBarTone;
  }>(),
  {
    tone: "primary",
  },
);

const toneClasses: Record<ProgressBarTone, string> = {
  danger: "bg-error",
  neutral: "bg-text-muted",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
};
</script>

<template>
  <div class="h-2 w-full overflow-hidden rounded-full bg-border">
    <div
      class="h-full rounded-full transition-all duration-300"
      :class="toneClasses[tone]"
      :style="{ width: `${Math.max(0, Math.min(100, percent))}%` }"
    />
  </div>
</template>
