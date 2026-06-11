<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    page: number;
    pageSize: number;
    totalItems: number;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:page": [page: number];
}>();

const currentPage = computed(() => clampPage(props.page));
const endItem = computed(() => Math.min(props.totalItems, currentPage.value * props.pageSize));
const pageCount = computed(() => Math.max(1, Math.ceil(props.totalItems / props.pageSize)));
const pageItems = computed(() => {
  const pages = new Set<number>();
  pages.add(1);
  pages.add(currentPage.value);
  pages.add(pageCount.value);

  for (let offset = -1; offset <= 1; offset += 1) {
    pages.add(clampPage(currentPage.value + offset));
  }

  const sortedPages = Array.from(pages).sort((left, right) => left - right);
  const items: Array<"gap" | number> = [];

  for (const page of sortedPages) {
    const previous = items.at(-1);
    if (typeof previous === "number" && page - previous > 1) {
      items.push("gap");
    }
    items.push(page);
  }

  return items;
});
const showRange = computed(() => props.totalItems > 0);
const startItem = computed(() => (props.totalItems === 0 ? 0 : (currentPage.value - 1) * props.pageSize + 1));

function clampPage(page: number): number {
  return Math.min(Math.max(1, page), pageCount.value);
}

function goToPage(page: number): void {
  if (props.disabled) {
    return;
  }

  emit("update:page", clampPage(page));
}
</script>

<template>
  <nav
    class="flex flex-col gap-3 border-t border-border bg-surface px-4 py-3 text-body text-text-primary sm:flex-row sm:items-center sm:justify-between"
    aria-label="Pagination"
  >
    <p class="text-caption text-text-muted">
      <template v-if="showRange">
        {{ startItem }}-{{ endItem }} / {{ totalItems }}
      </template>
      <template v-else>
        0 / 0
      </template>
    </p>

    <div class="flex flex-wrap items-center gap-1">
      <button
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-caption transition hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted"
        :disabled="disabled || currentPage <= 1"
        type="button"
        aria-label="Previous page"
        @click="goToPage(currentPage - 1)"
      >
        &lt;
      </button>

      <template
        v-for="(item, index) in pageItems"
        :key="`${item}-${index}`"
      >
        <span
          v-if="item === 'gap'"
          class="grid h-9 min-w-9 place-items-center px-1 text-caption text-text-muted"
        >
          ...
        </span>
        <button
          v-else
          class="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-caption transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted"
          :class="item === currentPage ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:bg-surface-subtle'"
          :disabled="disabled"
          type="button"
          :aria-current="item === currentPage ? 'page' : undefined"
          :aria-label="`Page ${item}`"
          @click="goToPage(item)"
        >
          {{ item }}
        </button>
      </template>

      <button
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-surface px-3 text-caption transition hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted"
        :disabled="disabled || currentPage >= pageCount"
        type="button"
        aria-label="Next page"
        @click="goToPage(currentPage + 1)"
      >
        &gt;
      </button>
    </div>
  </nav>
</template>
