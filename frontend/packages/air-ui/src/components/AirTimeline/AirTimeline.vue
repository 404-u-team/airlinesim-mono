<script setup lang="ts">
export type AirTimelineItem = {
  detail?: string;
  id: string;
  meta?: string;
  title: string;
  tone?: "danger" | "neutral" | "success" | "warning";
};

type TimelineTone = NonNullable<AirTimelineItem["tone"]>;

withDefaults(
  defineProps<{
    items: AirTimelineItem[];
  }>(),
  {},
);

const toneClasses: Record<TimelineTone, string> = {
  danger: "border-error bg-error-bg text-error",
  neutral: "border-border bg-surface text-text-muted",
  success: "border-success bg-success-bg text-success",
  warning: "border-warning bg-warning-bg text-warning",
};
</script>

<template>
  <ol class="grid gap-3">
    <li
      v-for="(item, index) in items"
      :key="item.id"
      class="grid grid-cols-[2rem_minmax(0,1fr)] gap-3"
    >
      <div class="relative flex justify-center">
        <span
          class="grid size-8 place-items-center rounded-full border text-caption"
          :class="toneClasses[item.tone ?? 'neutral']"
        >
          {{ index + 1 }}
        </span>
        <span
          v-if="index < items.length - 1"
          class="absolute top-8 bottom-[-0.75rem] w-px bg-border"
        />
      </div>
      <div class="min-w-0 rounded-lg border border-border bg-surface p-3">
        <div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <h3 class="truncate text-subtitle text-text-primary">
            {{ item.title }}
          </h3>
          <span
            v-if="item.meta"
            class="shrink-0 text-caption text-text-muted"
          >
            {{ item.meta }}
          </span>
        </div>
        <p
          v-if="item.detail"
          class="mt-1 text-caption text-text-muted"
        >
          {{ item.detail }}
        </p>
      </div>
    </li>
  </ol>
</template>
