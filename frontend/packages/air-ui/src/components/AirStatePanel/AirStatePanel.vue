<script setup lang="ts">
type StateTone = "danger" | "info" | "success" | "warning";

withDefaults(
  defineProps<{
    body?: string;
    title: string;
    tone?: StateTone;
  }>(),
  {
    body: undefined,
    tone: "info",
  },
);

const toneClasses: Record<StateTone, string> = {
  danger: "border-error bg-error-bg text-on-error-soft",
  info: "border-border bg-surface text-text-primary",
  success: "border-success bg-success-bg text-on-success-soft",
  warning: "border-warning bg-warning-bg text-on-warning-soft",
};
</script>

<template>
  <section
    class="rounded-lg border p-4"
    :class="toneClasses[tone]"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-subtitle">
          {{ title }}
        </h2>
        <p
          v-if="body"
          class="mt-1 text-body opacity-80"
        >
          {{ body }}
        </p>
      </div>
      <div
        v-if="$slots.action"
        class="shrink-0"
      >
        <slot name="action" />
      </div>
    </div>
  </section>
</template>
