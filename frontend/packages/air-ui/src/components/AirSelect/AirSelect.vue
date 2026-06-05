<script setup lang="ts">
import { computed } from "vue";

export type AirSelectOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    label: string;
    modelValue: string;
    options: AirSelectOption[];
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const selectedValue = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});
</script>

<template>
  <label class="inline-flex min-w-40 flex-col gap-1">
    <span class="sr-only">{{ label }}</span>
    <select
      v-model="selectedValue"
      class="h-10 rounded-lg border border-border bg-surface px-3 text-body text-text-primary outline-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted"
      :aria-label="label"
      :disabled="disabled"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
