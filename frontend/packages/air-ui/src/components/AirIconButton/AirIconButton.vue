<script setup lang="ts">
import { computed } from "vue";

type IconButtonSize = "lg" | "md" | "sm";
type IconButtonVariant = "primary" | "surface";

const props = withDefaults(
  defineProps<{
    active?: boolean;
    disabled?: boolean;
    label: string;
    size?: IconButtonSize;
    type?: "button" | "reset" | "submit";
    variant?: IconButtonVariant;
  }>(),
  {
    active: false,
    disabled: false,
    size: "md",
    type: "button",
    variant: "surface",
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const sizeClasses: Record<IconButtonSize, string> = {
  lg: "size-12",
  md: "size-10",
  sm: "size-9",
};

const buttonClass = computed(() => [
  "inline-flex shrink-0 items-center justify-center rounded-lg border text-text-primary",
  "transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2",
  "disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted disabled:opacity-70",
  sizeClasses[props.size],
  props.active || props.variant === "primary"
    ? "border-primary bg-primary text-on-primary hover:brightness-110 focus-visible:outline-primary"
    : "border-border bg-surface text-text-primary hover:bg-surface-subtle focus-visible:outline-primary",
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
    :aria-label="label"
    :aria-pressed="active || undefined"
    :title="label"
    @click="onClick"
  >
    <slot />
  </button>
</template>
