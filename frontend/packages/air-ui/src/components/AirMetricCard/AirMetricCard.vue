<script setup lang="ts">
import AirIconButton from "../AirIconButton/AirIconButton.vue";

type MetricTone = "danger" | "neutral" | "success" | "warning";

const props = withDefaults(
  defineProps<{
    hint?: string;
    infoLabel?: string;
    label: string;
    tone?: MetricTone;
    value: string;
  }>(),
  {
    hint: undefined,
    infoLabel: undefined,
    tone: "neutral",
  },
);

const emit = defineEmits<{
  info: [];
}>();

const toneClasses: Record<MetricTone, string> = {
  danger: "border-error bg-error-bg text-on-error-soft",
  neutral: "border-border bg-surface text-text-primary",
  success: "border-success bg-success-bg text-on-success-soft",
  warning: "border-warning bg-warning-bg text-on-warning-soft",
};
</script>

<template>
  <article
    class="min-w-0 rounded-lg border p-4 relative"
    :class="toneClasses[tone]"
  >
    <div class="flex items-start justify-between gap-4">
      <p class="truncate text-caption opacity-75 pr-6">
        {{ label }}
      </p>
      <AirIconButton
        v-if="infoLabel"
        class="absolute top-3 right-3 !size-6 !rounded-md"
        size="sm"
        variant="surface"
        :label="infoLabel"
        @click.stop="emit('info')"
      >
        <span class="text-xs font-semibold leading-none select-none">i</span>
      </AirIconButton>
    </div>
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
