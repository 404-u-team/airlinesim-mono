<script setup lang="ts">
import { computed } from "vue";

type ButtonSize = "lg" | "md" | "sm";

type ButtonVariant =
  | "danger"
  | "danger-soft"
  | "primary"
  | "primary-soft"
  | "success"
  | "success-soft"
  | "warning"
  | "warning-soft";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    label?: string;
    size?: ButtonSize;
    type?: "button" | "reset" | "submit";
    variant?: ButtonVariant;
  }>(),
  {
    disabled: false,
    label: undefined,
    size: "md",
    type: "button",
    variant: "primary",
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const variantClasses: Record<ButtonVariant, string> = {
  danger: "bg-error text-white hover:brightness-110 focus-visible:outline-error",
  "danger-soft": "bg-error-bg text-slate-950 hover:brightness-95 focus-visible:outline-error",
  primary: "bg-primary text-on-primary hover:brightness-110 focus-visible:outline-primary",
  "primary-soft":
    "bg-primary-soft text-on-primary-soft hover:brightness-95 focus-visible:outline-primary",
  success: "bg-success text-white hover:brightness-110 focus-visible:outline-success",
  "success-soft": "bg-success-bg text-slate-950 hover:brightness-95 focus-visible:outline-success",
  warning: "bg-warning text-white hover:brightness-110 focus-visible:outline-warning",
  "warning-soft": "bg-warning-bg text-slate-950 hover:brightness-95 focus-visible:outline-warning",
};

const sizeClasses: Record<ButtonSize, string> = {
  lg: "h-12 min-w-40 px-8 text-lg",
  md: "h-11 min-w-36 px-7 text-base",
  sm: "h-9 min-w-28 px-5 text-sm",
};

const buttonClass = computed(() => [
  "inline-flex items-center justify-center rounded-lg text-subtitle leading-none",
  "transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2",
  "disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted disabled:opacity-70",
  sizeClasses[props.size],
  variantClasses[props.variant],
]);

function onClick(event: MouseEvent): void {
  emit("click", event);
}
</script>

<template>
  <button
    :type="type"
    :class="buttonClass"
    :disabled="disabled"
    @click="onClick"
  >
    <slot>{{ label }}</slot>
  </button>
</template>
