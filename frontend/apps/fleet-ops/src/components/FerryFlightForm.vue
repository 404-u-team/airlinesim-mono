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

const hubs = ref<HubOption[]>([]);
const destinationId = ref("");
const date = ref(new Date().toISOString().slice(0, 10));
const time = ref("09:00");
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
  <section class="grid content-start gap-3 rounded-lg border border-border bg-surface p-3">
    <div>
      <p class="text-caption font-semibold text-text-muted">
        {{ props.t("operations.ferry.title") }}
      </p>
      <p class="mt-1 text-caption text-text-muted">
        {{ props.t("operations.ferry.subtitle") }}
      </p>
    </div>

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
  </section>
</template>
