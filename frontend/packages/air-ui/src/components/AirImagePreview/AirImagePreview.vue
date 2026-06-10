<script setup lang="ts">
import { computed, ref, watch } from "vue";

type AspectRatio = "auto" | "square" | "video" | "wide";
type ImageFit = "contain" | "cover";

const props = withDefaults(
  defineProps<{
    alt?: string;
    aspectRatio?: AspectRatio;
    fit?: ImageFit;
    src?: string;
  }>(),
  {
    alt: "Image Preview",
    aspectRatio: "video",
    fit: "cover",
    src: "",
  },
);

const emit = defineEmits<{
  error: [];
  load: [dimensions: { height: number; width: number }];
}>();

const isLoading = ref(false);
const isError = ref(false);
const localFit = ref<ImageFit>(props.fit);
const dimensions = ref<null | { height: number; width: number }>(null);

// Sync fit prop changes
watch(
  () => props.fit,
  (newFit) => {
    localFit.value = newFit;
  },
);

// Watch for src changes and reset states
watch(
  () => props.src,
  (newSrc) => {
    isError.value = false;
    dimensions.value = null;
    if (newSrc && newSrc.trim()) {
      isLoading.value = true;
    } else {
      isLoading.value = false;
    }
  },
  { immediate: true },
);

function handleImageError(): void {
  isLoading.value = false;
  isError.value = true;
  dimensions.value = null;
  emit("error");
}

function handleImageLoad(event: Event): void {
  const img = event.target as HTMLImageElement;
  dimensions.value = {
    height: img.naturalHeight,
    width: img.naturalWidth,
  };
  isLoading.value = false;
  isError.value = false;
  emit("load", { height: img.naturalHeight, width: img.naturalWidth });
}

function toggleFit(): void {
  localFit.value = localFit.value === "cover" ? "contain" : "cover";
}

const aspectClasses: Record<AspectRatio, string> = {
  auto: "aspect-auto",
  square: "aspect-square",
  video: "aspect-video",
  wide: "aspect-[21/9]",
};

const containerClass = computed(() => [
  "relative overflow-hidden rounded-xl border border-border bg-background/50 flex items-center justify-center transition duration-200",
  aspectClasses[props.aspectRatio],
  isError.value ? "border-error/30 bg-error-bg/10" : "",
]);

const imgClass = computed(() => [
  "size-full transition duration-300",
  localFit.value === "cover" ? "object-cover" : "object-contain bg-slate-950/20",
]);
</script>

<template>
  <div :class="containerClass">
    <!-- Image Display -->
    <img
      v-if="src && src.trim() && !isError"
      :alt="alt"
      :class="imgClass"
      :src="src"
      @error="handleImageError"
      @load="handleImageLoad"
    />

    <!-- Empty/No URL Placeholder State -->
    <div
      v-if="!src || !src.trim()"
      class="flex flex-col items-center justify-center p-6 text-center text-text-muted"
    >
      <svg
        class="size-10 text-text-muted/60"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        viewBox="0 0 24 24"
      >
        <path
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="mt-2 text-caption">No image proposed</span>
    </div>

    <!-- Error State -->
    <div
      v-else-if="isError"
      class="absolute inset-0 flex flex-col items-center justify-center bg-error-bg/10 p-6 text-center text-error"
    >
      <svg
        class="size-10 text-error"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="mt-2 text-caption font-medium">Failed to load image URL</span>
      <span class="mt-1 max-w-[200px] text-[10px] text-text-muted truncate" :title="src">
        {{ src }}
      </span>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="isLoading"
      class="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]"
    >
      <div
        class="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
      />
    </div>

    <!-- Hover Overlays & Controls when Image Loaded -->
    <div
      v-if="src && src.trim() && !isError && !isLoading"
      class="absolute inset-0 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200 pointer-events-none flex flex-col justify-between p-3 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/30 text-white"
    >
      <!-- Top Badges -->
      <div class="flex items-start justify-between pointer-events-auto">
        <span class="rounded bg-slate-950/70 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
          Preview
        </span>
        <button
          class="rounded bg-slate-950/70 p-1.5 text-white hover:bg-slate-950/90 transition shadow-sm"
          title="Toggle Object Fit"
          type="button"
          @click="toggleFit"
        >
          <!-- fit cover/contain svg -->
          <svg
            v-if="localFit === 'cover'"
            class="size-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9m5.25 11.25v-4.5m0 4.5h-4.5m4.5 0L15 15"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg
            v-else
            class="size-3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 9V3.75m0 5.25H3.75M9 9 3.75 3.75M9 15v5.25m0-5.25H3.75M9 15l-5.25 5.25M15 9V3.75m0 5.25h5.25M15 9l5.25-5.25M15 15v5.25m0-5.25h5.25m-5.25 0 5.25 5.25"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <!-- Bottom Metadata -->
      <div class="flex items-center justify-between text-[11px]">
        <div v-if="dimensions" class="rounded bg-slate-950/70 px-2 py-0.5 font-mono">
          {{ dimensions.width }} × {{ dimensions.height }} px
        </div>
        <span class="rounded bg-slate-950/70 px-2 py-0.5 capitalize">
          Fit: {{ localFit }}
        </span>
      </div>
    </div>
  </div>
</template>
