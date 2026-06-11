<script setup lang="ts">
import {
  AirButton,
  AirModal,
  AirTextField
} from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, ref } from "vue";

import type { AircraftType } from "../types";

import { createAircraftType } from "../api/aircraftTypesApi";
import {
  type AdminAircraftMessageKey,
  adminAircraftMessages,
  adminText,
  type AdminTextKey
} from "../i18n";

const props = defineProps<{
  appLocale: Locale;
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  created: [type: AircraftType];
  error: [msg: string];
}>();

const t = computed(() => (key: AdminAircraftMessageKey): string =>
  translate(adminAircraftMessages, props.appLocale, key)
);

const at = computed(() => (key: AdminTextKey): string =>
  adminText(props.appLocale, key)
);

const isCreating = ref(false);
const createForm = ref({
  base_maintenance_points: "120",
  base_turnaround_points: "45",
  characteristics: "",
  cruising_speed_kph: "850",
  d_check_interval_fh: "24000",
  d_check_interval_years: "12",
  d_check_overdue_multiplier: "1.5",
  fuel_consumption_per_hour: "2400",
  iata_code: "",
  icao_code: "",
  image_upload_id: "",
  maint_cost_per_flight_hour: "250",
  maint_cost_per_landing: "150",
  maint_cost_per_takeoff: "100",
  manufacturer_id: "",
  max_planned_seat_capacity: "180",
  max_range_km: "6000",
  min_runway_length_m: "1800",
  model_name: "",
  mtow_kg: "75000",
  price_per_unit: "120000000",
  production_points_price: "1000",
});

async function handleCreateType(): Promise<void> {
  isCreating.value = true;
  try {
    const payload = {
      base_maintenance_points: Number(createForm.value.base_maintenance_points),
      base_turnaround_points: Number(createForm.value.base_turnaround_points),
      characteristics: createForm.value.characteristics || undefined,
      cruising_speed_kph: Number(createForm.value.cruising_speed_kph),
      d_check_interval_fh: Number(createForm.value.d_check_interval_fh),
      d_check_interval_years: Number(createForm.value.d_check_interval_years),
      d_check_overdue_multiplier: Number(createForm.value.d_check_overdue_multiplier),
      fuel_consumption_per_hour: Number(createForm.value.fuel_consumption_per_hour),
      iata_code: createForm.value.iata_code,
      icao_code: createForm.value.icao_code,
      image_upload_id: createForm.value.image_upload_id || undefined,
      maint_cost_per_flight_hour: Number(createForm.value.maint_cost_per_flight_hour),
      maint_cost_per_landing: Number(createForm.value.maint_cost_per_landing),
      maint_cost_per_takeoff: Number(createForm.value.maint_cost_per_takeoff),
      manufacturer_id: createForm.value.manufacturer_id,
      max_planned_seat_capacity: Number(createForm.value.max_planned_seat_capacity),
      max_range_km: Number(createForm.value.max_range_km),
      min_runway_length_m: Number(createForm.value.min_runway_length_m),
      model_name: createForm.value.model_name,
      mtow_kg: Number(createForm.value.mtow_kg),
      price_per_unit: Number(createForm.value.price_per_unit),
      production_points_price: Number(createForm.value.production_points_price),
    };
    const created = await createAircraftType(payload);
    emit("created", created);
    emit("close");
  } catch (err) {
    emit("error", "Failed to create aircraft type.");
  } finally {
    isCreating.value = false;
  }
}
</script>

<template>
  <AirModal
    :open="open"
    :title="t('createType')"
    size="lg"
    @close="emit('close')"
  >
    <form class="space-y-6" @submit.prevent="handleCreateType">
      <div class="grid gap-4 sm:grid-cols-2 max-h-[60vh] overflow-y-auto px-1 py-2">
        <!-- Column 1 -->
        <div class="space-y-4">
          <h3 class="text-subtitle border-b pb-1">
            General
          </h3>
          <AirTextField v-model="createForm.model_name" :label="t('modelName')" required />
          <AirTextField v-model="createForm.icao_code" :label="t('icaoCode')" required />
          <AirTextField v-model="createForm.iata_code" :label="t('iataCode')" required />
          <AirTextField v-model="createForm.manufacturer_id" :label="t('manufacturer')" required />
          <AirTextField
            v-model="createForm.price_per_unit"
            :label="t('pricePerUnit')"
            type="number"
            required
          />

          <h3 class="text-subtitle border-b pb-1 mt-6">
            Performance
          </h3>
          <AirTextField
            v-model="createForm.cruising_speed_kph"
            :label="t('speed')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.max_range_km"
            :label="t('range')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.min_runway_length_m"
            :label="t('minRunway')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.mtow_kg"
            :label="t('mtow')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.fuel_consumption_per_hour"
            :label="t('hourlyFuelBurn')"
            type="number"
            required
          />
        </div>

        <!-- Column 2 -->
        <div class="space-y-4">
          <h3 class="text-subtitle border-b pb-1">
            Operations
          </h3>
          <AirTextField
            v-model="createForm.max_planned_seat_capacity"
            :label="t('seats')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.base_maintenance_points"
            :label="t('baseMaintPoints')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.base_turnaround_points"
            :label="t('baseTurnaroundPoints')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.production_points_price"
            :label="t('productionPointsPrice')"
            type="number"
            required
          />

          <h3 class="text-subtitle border-b pb-1 mt-6">
            Maintenance
          </h3>
          <AirTextField
            v-model="createForm.maint_cost_per_flight_hour"
            :label="t('baseMaintCost')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.maint_cost_per_landing"
            :label="t('maintCostPerLanding')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.maint_cost_per_takeoff"
            :label="t('maintCostPerTakeoff')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.d_check_interval_fh"
            :label="t('dCheckIntervalFh')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.d_check_interval_years"
            :label="t('dCheckIntervalYears')"
            type="number"
            required
          />
          <AirTextField
            v-model="createForm.d_check_overdue_multiplier"
            :label="t('dCheckOverdueMultiplier')"
            type="number"
            required
          />
        </div>

        <!-- Bottom fields span 2 columns -->
        <div class="sm:col-span-2 space-y-4 pt-4 border-t">
          <AirTextField v-model="createForm.image_upload_id" :label="t('imageUploadId')" />
          <AirTextField v-model="createForm.characteristics" :label="t('characteristics')" />
        </div>
      </div>

      <div class="flex justify-end gap-3 border-t pt-4">
        <AirButton
          :label="at('cancel')"
          variant="primary-soft"
          size="sm"
          :disabled="isCreating"
          type="button"
          @click="emit('close')"
        />
        <AirButton
          :label="at('create')"
          size="sm"
          :disabled="isCreating"
          type="submit"
        />
      </div>
    </form>
  </AirModal>
</template>
