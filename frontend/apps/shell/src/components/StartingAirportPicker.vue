<script setup lang="ts">
/* eslint-disable vue/custom-event-name-casing -- update:modelValue is the Vue v-model contract. */
import { AirCombobox, type AirComboboxOption } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, onBeforeUnmount, ref, watch } from "vue";

import { type ShellMessageKey, shellMessages } from "../i18n/messages";
import { type OnboardingAirportOption, searchStartingAirports } from "../onboarding/api";
import AirportCard from "./StartingAirportPicker/AirportCard.vue";

const props = defineProps<{
  appLocale: Locale;
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "select-airport", airport: null | OnboardingAirportOption): void;
}>();

const airports = ref<OnboardingAirportOption[]>([]);
const loading = ref(false);
const error = ref<string | undefined>(undefined);
const selectedAirport = ref<null | OnboardingAirportOption>(null);

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

// Map airports list to AirCombobox options format
const comboboxOptions = computed<AirComboboxOption[]>(() =>
  airports.value.map((a) => ({
    airport: a,
    label: `${a.iata_code || a.icao_code || "---"} - ${a.intl_name || a.local_name || "Airport"}`,
    value: a.id,
  })),
);

let debounceTimeout: null | ReturnType<typeof setTimeout> = null;

function onSearch(query: string) {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
  debounceTimeout = setTimeout(() => {
    void performSearch(query);
  }, 300);
}

async function performSearch(query: string) {
  loading.value = true;
  error.value = undefined;
  try {
    airports.value = await searchStartingAirports(query);
  } catch {
    error.value = t.value("onboarding.airport.error");
  } finally {
    loading.value = false;
  }
}

// Watch modelValue and airports list to find selected airport details
watch(
  [() => props.modelValue, airports],
  () => {
    if (!props.modelValue) {
      selectedAirport.value = null;
      emit("select-airport", null);
      return;
    }
    const found = airports.value.find((a) => a.id === props.modelValue);
    if (found) {
      selectedAirport.value = found;
      emit("select-airport", found);
    }
  },
  { immediate: true },
);

// Trigger initial search for empty query to pre-populate options list
void performSearch("");

onBeforeUnmount(() => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
});
</script>

<template>
  <div class="space-y-4">
    <AirCombobox
      :model-value="modelValue"
      :options="comboboxOptions"
      :label="t('airline.startingAirportId')"
      :placeholder="t('onboarding.airport.searchPlaceholder')"
      :loading="loading"
      :loading-text="t('onboarding.airport.loading')"
      :error="error"
      :empty-text="t('onboarding.airport.empty')"
      @update:model-value="emit('update:modelValue', $event)"
      @search="onSearch"
    >
      <!-- Custom Option Rendering Slot -->
      <template #option="{ option }">
        <AirportCard
          :airport="option.airport as OnboardingAirportOption"
          :app-locale="appLocale"
          variant="compact"
        />
      </template>
    </AirCombobox>

    <!-- Detailed Selected Airport Card -->
    <div
      v-if="selectedAirport"
      class="pt-2"
    >
      <span class="text-caption text-text-muted mb-1.5 block">
        {{ t('onboarding.airport.startingBase') }}
      </span>
      <AirportCard
        :airport="selectedAirport"
        :app-locale="appLocale"
        variant="detailed"
      />
    </div>
  </div>
</template>
