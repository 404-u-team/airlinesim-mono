<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useId, watch } from "vue";

export type AirComboboxOption = {
  [key: string]: unknown;
  label: string;
  value: string;
};

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    emptyText?: string;
    error?: string;
    hint?: string;
    label: string;
    loading?: boolean;
    loadingText?: string;
    modelValue: string;
    options: AirComboboxOption[];
    placeholder?: string;
  }>(),
  {
    disabled: false,
    emptyText: "No results found",
    error: undefined,
    hint: undefined,
    loading: false,
    loadingText: "Loading...",
    placeholder: "",
  },
);

const emit = defineEmits<{
  search: [query: string];
  "update:modelValue": [value: string];
}>();

const containerRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
const searchQuery = ref("");
const highlightedIndex = ref(-1);
const fieldId = useId();
const descriptionId = computed(() => `${fieldId}-description`);
const listboxId = computed(() => `${fieldId}-listbox`);

const selectedOption = computed(() => props.options.find((opt) => opt.value === props.modelValue));

// Sync input text with modelValue
watch(
  () => props.modelValue,
  (val) => {
    if (val && selectedOption.value) {
      searchQuery.value = selectedOption.value.label;
    } else if (!val) {
      searchQuery.value = "";
    }
  },
  { immediate: true },
);

function handleArrowDown(event: KeyboardEvent): void {
  event.preventDefault();
  if (!isOpen.value) {
    isOpen.value = true;
    highlightedIndex.value = 0;
  } else if (props.options.length > 0) {
    highlightedIndex.value = (highlightedIndex.value + 1) % props.options.length;
  }
}

function handleArrowUp(event: KeyboardEvent): void {
  event.preventDefault();
  if (!isOpen.value) {
    isOpen.value = true;
    highlightedIndex.value = props.options.length - 1;
  } else if (props.options.length > 0) {
    highlightedIndex.value = (highlightedIndex.value - 1 + props.options.length) % props.options.length;
  }
}

function handleClickOutside(event: MouseEvent): void {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false;
    highlightedIndex.value = -1;
    // Re-sync input field text
    if (selectedOption.value) {
      searchQuery.value = selectedOption.value.label;
    } else {
      searchQuery.value = "";
    }
  }
}

function handleEnter(event: KeyboardEvent): void {
  event.preventDefault();
  if (isOpen.value && highlightedIndex.value >= 0 && highlightedIndex.value < props.options.length) {
    const option = props.options[highlightedIndex.value];
    if (option) {
      selectOption(option);
    }
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  if (props.disabled) {
    return;
  }

  if (event.key === "ArrowDown") {
    handleArrowDown(event);
  } else if (event.key === "ArrowUp") {
    handleArrowUp(event);
  } else if (event.key === "Enter") {
    handleEnter(event);
  } else if (event.key === "Escape") {
    isOpen.value = false;
    highlightedIndex.value = -1;
  }
}

function onFocus(): void {
  if (props.disabled) {
    return;
  }
  isOpen.value = true;
  highlightedIndex.value = 0;
  // Clear search field to allow searching all when user clicks
  searchQuery.value = "";
  emit("search", "");
}

function onInput(event: Event): void {
  const { value } = event.target as HTMLInputElement;
  searchQuery.value = value;
  emit("search", value);
  isOpen.value = true;
  highlightedIndex.value = 0;
}

function selectOption(option: AirComboboxOption): void {
  // eslint-disable-next-line vue/custom-event-name-casing -- required by Vue v-model
  emit("update:modelValue", option.value);
  searchQuery.value = option.label;
  isOpen.value = false;
  highlightedIndex.value = -1;
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});

const message = computed(() => props.error ?? props.hint);
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex min-w-0 flex-col gap-1.5 w-full"
  >
    <label
      class="text-caption text-text-muted"
      :for="fieldId"
    >
      {{ label }}
    </label>

    <div class="relative w-full">
      <input
        :id="fieldId"
        v-model="searchQuery"
        type="text"
        role="combobox"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        :aria-describedby="message ? descriptionId : undefined"
        :aria-invalid="Boolean(error)"
        :disabled="disabled"
        :placeholder="placeholder"
        class="h-11 w-full rounded-lg border bg-surface px-3 text-body text-text-primary outline-none transition placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-muted"
        :class="error ? 'border-error focus-visible:outline-error' : 'border-border focus-visible:outline-primary'"
        @input="onInput"
        @focus="onFocus"
        @keydown="handleKeyDown"
      />

      <!-- Dropdown list -->
      <ul
        v-if="isOpen"
        :id="listboxId"
        role="listbox"
        class="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-lg outline-none divide-y divide-border"
      >
        <li
          v-if="loading"
          class="px-4 py-3 text-body text-text-muted flex items-center gap-2"
        >
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent" />
          <span>{{ loadingText }}</span>
        </li>
        <li
          v-else-if="options.length === 0"
          class="px-4 py-3 text-body text-text-muted"
        >
          {{ emptyText }}
        </li>
        <template v-else>
          <li
            v-for="(option, index) in options"
            :key="option.value"
            role="option"
            :aria-selected="option.value === modelValue"
            class="cursor-pointer select-none transition-colors"
            :class="[
              index === highlightedIndex
                ? 'bg-surface-subtle text-primary'
                : 'text-text-primary hover:bg-surface-subtle',
              option.value === modelValue ? 'font-semibold' : '',
            ]"
            @click="selectOption(option)"
            @mouseenter="highlightedIndex = index"
          >
            <slot
              name="option"
              :option="option"
            >
              <div class="px-4 py-3 text-body">
                {{ option.label }}
              </div>
            </slot>
          </li>
        </template>
      </ul>
    </div>

    <span
      v-if="message"
      :id="descriptionId"
      class="min-h-4 text-caption"
      :class="error ? 'text-error' : 'text-text-muted'"
    >
      {{ message }}
    </span>
  </div>
</template>
