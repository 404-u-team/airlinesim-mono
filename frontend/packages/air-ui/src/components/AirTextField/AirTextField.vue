<script setup lang="ts">
import { computed, useId } from "vue";

type TextFieldType = "email" | "password" | "search" | "text";

const props = withDefaults(
  defineProps<{
    autocomplete?: string;
    disabled?: boolean;
    error?: string;
    hint?: string;
    label: string;
    modelValue: string;
    name?: string;
    placeholder?: string;
    required?: boolean;
    type?: TextFieldType;
  }>(),
  {
    autocomplete: undefined,
    disabled: false,
    error: undefined,
    hint: undefined,
    name: undefined,
    placeholder: undefined,
    required: false,
    type: "text",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const fieldId = useId();
const descriptionId = computed(() => `${fieldId}-description`);
const message = computed(() => props.error ?? props.hint);
const inputClass = computed(() => [
  "h-11 w-full rounded-lg border bg-surface px-3 text-body text-text-primary outline-none transition",
  "placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted",
  props.error
    ? "border-error focus-visible:outline-error"
    : "border-border focus-visible:outline-primary",
]);

function updateValue(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <label
    class="flex min-w-0 flex-col gap-1.5"
    :for="fieldId"
  >
    <span class="text-caption text-text-muted">
      {{ label }}
    </span>
    <input
      :id="fieldId"
      :aria-describedby="message ? descriptionId : undefined"
      :aria-invalid="Boolean(error)"
      :autocomplete="autocomplete"
      :class="inputClass"
      :disabled="disabled"
      :name="name"
      :placeholder="placeholder"
      :required="required"
      :type="type"
      :value="modelValue"
      @input="updateValue"
    />
    <span
      v-if="message"
      :id="descriptionId"
      class="min-h-4 text-caption"
      :class="error ? 'text-error' : 'text-text-muted'"
    >
      {{ message }}
    </span>
  </label>
</template>
