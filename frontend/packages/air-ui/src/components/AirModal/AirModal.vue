<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";

type ModalSize = "lg" | "md" | "sm";

const props = withDefaults(
  defineProps<{
    closeLabel?: string;
    open: boolean;
    size?: ModalSize;
    title?: string;
  }>(),
  {
    closeLabel: "Close",
    size: "md",
    title: undefined,
  },
);

const emit = defineEmits<{
  close: [];
}>();

const sizeClasses: Record<ModalSize, string> = {
  lg: "max-w-3xl",
  md: "max-w-xl",
  sm: "max-w-md",
};

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape" && props.open) {
    emit("close");
  }
}

watch(
  () => props.open,
  (open) => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = open ? "hidden" : "";
    }
  },
);

onMounted(() => {
  document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  if (typeof document !== "undefined") {
    document.body.style.overflow = "";
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="air-modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4"
        role="presentation"
        @click.self="emit('close')"
      >
        <div
          aria-modal="true"
          class="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface text-text-primary shadow-xl sm:rounded-2xl"
          :class="sizeClasses[size]"
          role="dialog"
        >
          <header
            v-if="title || $slots.header"
            class="flex items-start justify-between gap-3 border-b border-border px-5 py-4"
          >
            <div class="min-w-0">
              <slot name="header">
                <h2 class="text-subtitle">
                  {{ title }}
                </h2>
              </slot>
            </div>
            <button
              :aria-label="closeLabel"
              class="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-text-muted transition hover:bg-surface-subtle hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :title="closeLabel"
              type="button"
              @click="emit('close')"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <slot />
          </div>

          <footer
            v-if="$slots.footer"
            class="border-t border-border px-5 py-4"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.air-modal-enter-active,
.air-modal-leave-active {
  transition: opacity 0.15s ease;
}

.air-modal-enter-from,
.air-modal-leave-to {
  opacity: 0;
}
</style>
