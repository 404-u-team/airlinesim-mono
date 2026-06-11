<script setup lang="ts">
import { computed } from "vue";

type BadgeSize = "lg" | "md" | "sm";

type BadgeVariant =
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
    label?: string;
    size?: BadgeSize;
    variant?: BadgeVariant;
  }>(),
  {
    label: undefined,
    size: "md",
    variant: "primary",
  },
);

const variantClasses: Record<BadgeVariant, string> = {
  danger: "bg-error text-on-error",
  "danger-soft": "bg-error-bg text-on-error-soft",
  primary: "bg-primary text-on-primary",
  "primary-soft": "bg-primary-soft text-on-primary-soft",
  success: "bg-success text-on-success",
  "success-soft": "bg-success-bg text-on-success-soft",
  warning: "bg-warning text-on-warning",
  "warning-soft": "bg-warning-bg text-on-warning-soft",
};

const sizeClasses: Record<BadgeSize, string> = {
  lg: "h-8 px-4 text-sm",
  md: "h-6 px-3 text-xs",
  sm: "h-5 px-2 text-[10px]",
};

const badgeClass = computed(() => [
  "inline-flex items-center justify-center rounded-full text-caption leading-none whitespace-nowrap",
  sizeClasses[props.size],
  variantClasses[props.variant],
]);
</script>

<template>
  <span :class="badgeClass">
    <slot>{{ label }}</slot>
  </span>
</template>
