<script setup lang="ts">
export type AirSegmentedControlOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

withDefaults(
  defineProps<{
    disabled?: boolean;
    label: string;
    modelValue: string;
    options: AirSegmentedControlOption[];
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  select: [value: string];
}>();
</script>

<template>
  <div
    class="inline-flex min-h-10 flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
    role="radiogroup"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      class="min-h-8 rounded-md px-3 py-1.5 text-caption transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted"
      :class="option.value === modelValue ? 'bg-primary text-on-primary' : 'text-text-muted hover:bg-surface-subtle hover:text-text-primary'"
      :disabled="disabled || option.disabled"
      role="radio"
      :aria-checked="option.value === modelValue"
      type="button"
      @click="emit('select', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
