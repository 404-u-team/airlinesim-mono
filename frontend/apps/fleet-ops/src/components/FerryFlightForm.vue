<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirSelect, AirTextField } from "@airlinesim/air-ui";
import { computed, onMounted, ref } from "vue";

import type { FleetMessageKey } from "../i18n";
import type { HubOption } from "../types";

import { createFerryFlight, getHubs } from "../api";

const props = defineProps<{
  appLocale: Locale;
  selectedAircraftId: string;
  t: (key: FleetMessageKey | string) => string;
}>();

const emit = defineEmits<{
  created: [];
}>();

const isOpen = ref(false);

const hubs = ref<HubOption[]>([]);
const destinationId = ref("");
const date = ref("");
const time = ref("");

function toggleOpen(): void {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    const nowPlus10 = new Date(Date.now() + 10 * 60_000);
    date.value = nowPlus10.toISOString().slice(0, 10);
    time.value = nowPlus10.toISOString().slice(11, 16);
  }
}
const error = ref("");
const success = ref("");
const isSaving = ref(false);

const hubOptions = computed(() => hubs.value.map((hub) => ({ label: hub.label, value: hub.airport_id })));

onMounted(() => {
  void loadHubs();
});

async function loadHubs(): Promise<void> {
  try {
    hubs.value = (await getHubs()).hubs;
  } catch {
    hubs.value = [];
  }
}

async function submit(): Promise<void> {
  error.value = "";
  success.value = "";

  if (!props.selectedAircraftId) {
    error.value = props.t("operations.ferry.selectAircraft");
    return;
  }
  if (!destinationId.value) {
    error.value = props.t("operations.ferry.selectDestination");
    return;
  }

  isSaving.value = true;
  try {
    await createFerryFlight({
      aircraft_id: props.selectedAircraftId,
      departure_date: date.value,
      departure_local_time: time.value,
      destination_airport_id: destinationId.value,
    });
    success.value = props.t("operations.ferry.success");
    emit("created");
  } catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : props.t("operations.ferry.error");
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <section class="grid content-start gap-2 rounded-lg border border-border bg-surface-subtle p-3 transition-all duration-200">
    <button
      class="flex w-full items-center justify-between text-left text-caption font-bold text-text-primary outline-hidden cursor-pointer"
      type="button"
      @click="toggleOpen"
    >
      <span>{{ props.t("operations.ferry.title") }}</span>
      <span class="text-[10px] text-text-muted transition-transform duration-200" :class="isOpen ? 'rotate-180' : ''">▼</span>
    </button>

    <div v-if="isOpen" class="grid gap-3 pt-2 border-t border-border mt-1">
      <p class="text-caption text-text-muted">
        {{ props.t("operations.ferry.subtitle") }}
      </p>

      <div class="flex flex-col gap-1">
        <span class="text-caption text-text-muted">{{ props.t("operations.ferry.destination") }}</span>
        <AirSelect
          v-model="destinationId"
          class="w-full"
          :label="props.t('operations.ferry.destination')"
          :options="hubOptions"
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <AirTextField
          v-model="date"
          :label="props.t('operations.ferry.date')"
          type="date"
        />
        <AirTextField
          v-model="time"
          :label="props.t('operations.ferry.time')"
          type="time"
        />
      </div>

      <p
        v-if="error || success"
        class="rounded-md border px-3 py-2 text-caption"
        :class="error ? 'border-error bg-error-bg text-error' : 'border-success bg-success-bg text-success'"
      >
        {{ error || success }}
      </p>

      <AirButton
        :disabled="isSaving"
        :label="isSaving ? props.t('operations.ferry.creating') : props.t('operations.ferry.create')"
        size="sm"
        @click="submit"
      />
    </div>
  </section>
</template>
