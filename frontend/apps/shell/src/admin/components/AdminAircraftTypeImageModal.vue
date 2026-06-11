<script setup lang="ts">
import {
  AirButton,
  AirImagePreview,
  AirModal,
  AirTextField
} from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, ref, watch } from "vue";

import type { AircraftImageCandidate, AircraftType } from "../types";

import {
  clearAircraftImage,
  searchAircraftImages,
  setAircraftImage
} from "../api/aircraftTypesApi";
import {
  type AdminAircraftMessageKey,
  adminAircraftMessages,
  adminText,
  type AdminTextKey
} from "../i18n";

const props = defineProps<{
  aircraftType: AircraftType | null;
  appLocale: Locale;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  error: [msg: string];
  success: [msg: string];
}>();

const t = computed(() => (key: AdminAircraftMessageKey): string =>
  translate(adminAircraftMessages, props.appLocale, key)
);

const at = computed(() => (key: AdminTextKey): string =>
  adminText(props.appLocale, key)
);

const isSearchingImages = ref(false);
const imageTab = ref<"paste" | "search">("search");
const imageSearchQuery = ref("");
const imageCandidates = ref<AircraftImageCandidate[]>([]);
const selectedCandidate = ref<AircraftImageCandidate | null>(null);
const searchError = ref("");
const customImageUrl = ref("");
const customImageSource = ref("");
const customImageTitle = ref("");
const customImagePageUrl = ref("");
const isSavingImage = ref(false);
let activeSearchController: AbortController | null = null;

watch(
  () => props.open,
  (newOpen) => {
    if (newOpen && props.aircraftType) {
      imageSearchQuery.value = props.aircraftType.model_name;
      imageCandidates.value = [];
      selectedCandidate.value = null;
      searchError.value = "";
      customImageUrl.value = props.aircraftType.image_url || "";
      customImageSource.value = "";
      customImageTitle.value = "";
      customImagePageUrl.value = "";
      imageTab.value = "search";
      void handleSearchImages();
    } else if (activeSearchController) {
        activeSearchController.abort();
        activeSearchController = null;
      }
  }
);

function getSearchErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {return "Failed to search aircraft images.";}
  const isTimeout = err.message.toLowerCase().includes("timeout") || (err as { code?: string }).code === "ECONNABORTED";
  if (!isTimeout) {return err.message;}
  return props.appLocale === "ru"
    ? "Превышено время ожидания запроса (25 сек). Пожалуйста, попробуйте еще раз."
    : "Request timed out (25s). Please try again.";
}

async function handleResetImage(): Promise<void> {
  if (!props.aircraftType) {return;}
  isSavingImage.value = true;
  try {
    await clearAircraftImage(props.aircraftType.icao_code);
    emit("success", t.value("successImageCleared"));
    emit("close");
  } catch {
    emit("error", "Failed to reset aircraft image.");
  } finally {
    isSavingImage.value = false;
  }
}

async function handleSearchImages(): Promise<void> {
  if (!imageSearchQuery.value.trim()) {return;}
  if (activeSearchController) {
    activeSearchController.abort();
  }
  activeSearchController = new AbortController();
  isSearchingImages.value = true;
  searchError.value = "";
  try {
    const res = await searchAircraftImages(imageSearchQuery.value, {
      signal: activeSearchController.signal,
      timeout: 25000,
    });
    imageCandidates.value = res.candidates || [];
    selectedCandidate.value = null;
    if (imageCandidates.value.length === 0) {
      searchError.value = t.value("noCandidates");
    }
  } catch (err) {
    const isCancel = err instanceof Error && (err.name === "CanceledError" || err.message === "canceled");
    if (isCancel) {return;}
    imageCandidates.value = [];
    selectedCandidate.value = null;
    searchError.value = getSearchErrorMessage(err);
  } finally {
    if (activeSearchController && !activeSearchController.signal.aborted) {
      isSearchingImages.value = false;
    }
  }
}

const activePreviewUrl = computed(() => imageTab.value === "search" ? (selectedCandidate.value?.imageUrl || props.aircraftType?.image_url || "") : customImageUrl.value);
const activePreviewTitle = computed(() => imageTab.value === "search" ? (selectedCandidate.value?.title || props.aircraftType?.model_name || "") : customImageTitle.value);
const activePreviewSource = computed(() => imageTab.value === "search" ? (selectedCandidate.value?.source || "") : customImageSource.value);
const activePreviewPageUrl = computed(() => imageTab.value === "search" ? (selectedCandidate.value?.pageUrl || "") : customImagePageUrl.value);
const canSave = computed(() => imageTab.value === "search" ? Boolean(selectedCandidate.value) : (Boolean(customImageUrl.value.trim()) && customImageUrl.value !== props.aircraftType?.image_url));

async function handleSave(): Promise<void> {
  if (!props.aircraftType) {return;}
  isSavingImage.value = true;
  try {
    const isSearch = imageTab.value === "search";
    if (isSearch && !selectedCandidate.value) {return;}
    if (!isSearch && !customImageUrl.value.trim()) {return;}

    await setAircraftImage(props.aircraftType.icao_code, isSearch ? {
      imageUrl: selectedCandidate.value!.imageUrl,
      pageUrl: selectedCandidate.value!.pageUrl,
      source: selectedCandidate.value!.source,
      title: selectedCandidate.value!.title,
    } : {
      imageUrl: customImageUrl.value,
      pageUrl: customImagePageUrl.value,
      source: customImageSource.value || "Custom URL",
      title: customImageTitle.value || props.aircraftType.model_name,
    });
    emit("success", t.value("successImageUpdated"));
    emit("close");
  } catch {
    emit("error", "Failed to save aircraft image.");
  } finally {
    isSavingImage.value = false;
  }
}
</script>

<template>
  <AirModal
    :open="open"
    :title="t('changeImage')"
    size="lg"
    @close="emit('close')"
  >
    <div class="grid grid-cols-1 sm:grid-cols-12 gap-6 min-h-[420px]">
      <!-- Left Column: Source Selection (col-span-7) -->
      <div class="sm:col-span-7 flex flex-col min-h-0 space-y-4">
        <!-- Tabs -->
        <div class="flex border-b border-border">
          <button
            class="px-4 py-2 text-caption font-medium border-b-2 transition"
            :class="imageTab === 'search' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'"
            type="button"
            @click="imageTab = 'search'"
          >
            {{ t('searchSources') }}
          </button>
          <button
            class="px-4 py-2 text-caption font-medium border-b-2 transition"
            :class="imageTab === 'paste' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary'"
            type="button"
            @click="imageTab = 'paste'"
          >
            {{ t('pasteUrl') }}
          </button>
        </div>

        <!-- Search Tab -->
        <div v-if="imageTab === 'search'" class="flex-1 flex flex-col min-h-0 space-y-4">
          <div class="flex gap-2">
            <div class="flex-1">
              <AirTextField v-model="imageSearchQuery" :label="t('searchPlaceholder')" @keydown.enter="handleSearchImages" />
            </div>
            <div class="self-end pb-0.5">
              <AirButton
                :label="at('search')"
                size="sm"
                :disabled="isSearchingImages"
                type="button"
                @click="handleSearchImages"
              />
            </div>
          </div>

          <!-- Candidates Scroll Area -->
          <div class="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-1">
            <p v-if="isSearchingImages" class="text-center text-text-muted py-8 text-caption">
              {{ t('loadingCandidates') }}
            </p>
            <div v-else-if="searchError" class="p-4 text-center text-caption">
              <div v-if="searchError === t('noCandidates')" class="text-text-muted py-8">
                {{ searchError }}
              </div>
              <div v-else class="bg-error-bg/10 border border-error/20 text-error p-3 rounded-lg space-y-1">
                <p class="font-medium">
                  Search failed
                </p>
                <p class="text-[11px] opacity-90">
                  {{ searchError }}
                </p>
              </div>
            </div>
            <p v-else-if="imageCandidates.length === 0" class="text-center text-text-muted py-8 text-caption">
              {{ t('noCandidates') }}
            </p>

            <div
              v-for="candidate in imageCandidates"
              :key="candidate.imageUrl"
              class="flex gap-3 p-3 border rounded-lg transition cursor-pointer"
              :class="selectedCandidate?.imageUrl === candidate.imageUrl
                ? 'border-primary bg-primary-soft/10 ring-1 ring-primary'
                : 'border-border bg-surface-subtle hover:bg-surface'"
              @click="selectedCandidate = candidate"
            >
              <img :src="candidate.imageUrl" class="size-16 shrink-0 object-cover rounded border border-border bg-background" loading="lazy" />
              <div class="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <h4 class="font-medium text-caption text-text-primary truncate" :title="candidate.title">
                    {{ candidate.title || 'Untitled Candidate' }}
                  </h4>
                  <p class="text-[11px] text-text-muted mt-0.5 truncate">
                    {{ candidate.source || 'Unknown Source' }}
                  </p>
                </div>
                <div class="flex justify-end mt-1">
                  <span v-if="selectedCandidate?.imageUrl === candidate.imageUrl" class="text-[11px] text-primary font-medium flex items-center gap-1">
                    <svg
                      class="size-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      viewBox="0 0 24 24"
                    >
                      <path d="m4.5 12.75 6 6 9-13.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                    Selected
                  </span>
                  <span v-else class="text-[11px] text-text-muted hover:text-text-primary">Click to preview</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Paste Tab -->
        <div v-if="imageTab === 'paste'" class="space-y-3">
          <AirTextField
            v-model="customImageUrl"
            :label="t('customUrlLabel')"
            :placeholder="t('imageUrlPlaceholder')"
            required
          />
          <AirTextField v-model="customImageTitle" :label="t('modelName')" />
          <AirTextField v-model="customImageSource" :label="t('source')" />
          <AirTextField v-model="customImagePageUrl" :label="t('customUrlLabel') + ' Page'" />
        </div>
      </div>

      <!-- Right Column: Interactive Image Preview (col-span-5) -->
      <div class="sm:col-span-5 flex flex-col border-t sm:border-t-0 sm:border-l border-border/80 pt-6 sm:pt-0 pl-0 sm:pl-6 space-y-4 justify-between">
        <div class="space-y-3">
          <h3 class="text-caption font-medium text-text-muted uppercase tracking-wider">
            {{ t('imagePreview') }}
          </h3>
          <div class="group">
            <AirImagePreview :src="activePreviewUrl" :alt="activePreviewTitle" aspect-ratio="video" />
          </div>

          <!-- Metadata Box -->
          <div v-if="activePreviewUrl" class="rounded-lg border border-border bg-background/30 p-3 space-y-2 text-caption">
            <div class="flex flex-col min-w-0">
              <span class="text-[10px] text-text-muted uppercase">{{ t('modelName') }}</span>
              <span class="font-medium text-text-primary truncate" :title="activePreviewTitle">{{ activePreviewTitle || '-' }}</span>
            </div>
            <div v-if="activePreviewSource" class="flex flex-col min-w-0">
              <span class="text-[10px] text-text-muted uppercase">{{ t('source') }}</span>
              <span class="text-text-primary truncate" :title="activePreviewSource">{{ activePreviewSource }}</span>
            </div>
            <div v-if="activePreviewPageUrl" class="pt-1">
              <a
                :href="activePreviewPageUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <span>View original page</span>
                <svg
                  class="size-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </a>
            </div>
          </div>
          <div v-else class="rounded-lg border border-dashed border-border p-8 text-center text-caption text-text-muted">
            {{ t('previewPlaceholder') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Options / Modal Footer -->
    <template #footer>
      <div class="flex justify-between items-center w-full">
        <AirButton
          :label="t('resetAuto')"
          variant="primary-soft"
          size="sm"
          :disabled="isSavingImage"
          type="button"
          @click="handleResetImage"
        />
        <div class="flex gap-3">
          <AirButton
            :label="at('cancel')"
            variant="primary-soft"
            size="sm"
            :disabled="isSavingImage"
            type="button"
            @click="emit('close')"
          />
          <AirButton
            :label="t('confirmSelection')"
            size="sm"
            :disabled="!canSave || isSavingImage"
            type="button"
            @click="handleSave"
          />
        </div>
      </div>
    </template>
  </AirModal>
</template>
