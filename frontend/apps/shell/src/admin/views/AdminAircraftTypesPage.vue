<script setup lang="ts">
import {
  AirAircraftThumb,
  AirBadge,
  AirButton
} from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, onMounted, ref } from "vue";

import type { AircraftType } from "../types";

import { listAircraftTypes } from "../api/aircraftTypesApi";
import AdminAircraftTypeCreateModal from "../components/AdminAircraftTypeCreateModal.vue";
import AdminAircraftTypeImageModal from "../components/AdminAircraftTypeImageModal.vue";
import {
  type AdminAircraftMessageKey,
  adminAircraftMessages,
  adminText,
  type AdminTextKey
} from "../i18n";

const props = defineProps<{ appLocale: Locale }>();

const t = computed(() => (key: AdminAircraftMessageKey): string =>
  translate(adminAircraftMessages, props.appLocale, key)
);

const at = computed(() => (key: AdminTextKey): string =>
  adminText(props.appLocale, key)
);

const types = ref<AircraftType[]>([]);
const selectedType = ref<AircraftType | null>(null);
const isLoading = ref(false);
const error = ref("");
const successMsg = ref("");

const showCreateModal = ref(false);
const showImageModal = ref(false);

async function loadTypes(): Promise<void> {
  isLoading.value = true;
  error.value = "";
  try {
    const res = await listAircraftTypes();
    types.value = res.items || [];
    if (selectedType.value) {
      const updated = types.value.find(t => t.id === selectedType.value?.id);
      selectedType.value = updated || null;
    }
  } catch (err) {
    error.value = "Failed to load aircraft types.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadTypes();
});

function handleCreated(created: AircraftType): void {
  successMsg.value = t.value("successCreated");
  void loadTypes().then(() => {
    selectType(created);
  });
}

function handleError(msg: string): void {
  error.value = msg;
}

function handleSuccess(msg: string): void {
  successMsg.value = msg;
  void loadTypes();
}

function selectType(type: AircraftType): void {
  selectedType.value = type;
  successMsg.value = "";
  error.value = "";
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- Header -->
    <header class="flex shrink-0 items-center justify-between border-b border-border bg-surface px-6 py-4">
      <div>
        <h1 class="text-h2 text-text-primary">
          {{ t("title") }}
        </h1>
        <p class="text-caption text-text-muted mt-1">
          {{ at("total") }}: {{ types.length }}
        </p>
      </div>
      <AirButton :label="t('createType')" size="sm" @click="showCreateModal = true" />
    </header>

    <!-- Content Area (Dual Column) -->
    <div class="flex min-h-0 flex-1 flex-col lg:flex-row overflow-hidden bg-background">
      <!-- Left Column: List -->
      <div class="flex flex-1 flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-border max-h-[50vh] lg:max-h-none">
        <div class="flex-1 overflow-y-auto p-4 space-y-2">
          <p v-if="isLoading && types.length === 0" class="text-center text-text-muted p-8">
            {{ at("loading") }}
          </p>
          <div
            v-for="type in types"
            :key="type.id"
            class="flex items-center gap-4 p-3 rounded-lg border transition cursor-pointer hover:bg-surface-subtle"
            :class="selectedType?.id === type.id ? 'border-primary bg-surface-subtle' : 'border-border bg-surface'"
            @click="selectType(type)"
          >
            <AirAircraftThumb :image-url="type.image_url" :alt="type.model_name" size="md" />
            <div class="min-w-0 flex-1">
              <div class="font-medium text-text-primary truncate">
                {{ type.model_name }}
              </div>
              <div class="flex gap-2 mt-1">
                <AirBadge :label="type.icao_code" variant="primary-soft" size="sm" />
                <AirBadge
                  v-if="type.iata_code"
                  :label="type.iata_code"
                  variant="primary-soft"
                  size="sm"
                />
                <span class="text-caption text-text-muted truncate">
                  {{ type.manufacturer_id }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Details -->
      <div class="flex flex-1 flex-col overflow-y-auto p-6 bg-surface">
        <div v-if="successMsg" class="mb-4 rounded-lg bg-success-bg border border-success p-3 text-success text-body flex items-center justify-between">
          <span>{{ successMsg }}</span>
          <button type="button" class="text-success font-bold" @click="successMsg = ''">
            &times;
          </button>
        </div>

        <div v-if="error" class="mb-4 rounded-lg bg-error-bg border border-error p-3 text-error text-body flex items-center justify-between">
          <span>{{ error }}</span>
          <button type="button" class="text-error font-bold" @click="error = ''">
            &times;
          </button>
        </div>

        <div v-if="selectedType" class="space-y-6">
          <!-- Main Details Title + Image -->
          <div class="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <div class="relative group">
              <AirAircraftThumb
                :image-url="selectedType.image_url"
                :alt="selectedType.model_name"
                size="lg"
                class="!size-28"
              />
              <button
                type="button"
                class="absolute inset-0 bg-slate-950/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150 text-white text-caption font-medium"
                @click="showImageModal = true"
              >
                {{ t("changeImage") }}
              </button>
            </div>

            <div class="min-w-0 flex-1">
              <h2 class="text-h3 text-text-primary">
                {{ selectedType.model_name }}
              </h2>
              <div class="flex flex-wrap gap-2 mt-2">
                <AirBadge :label="`ICAO: ${selectedType.icao_code}`" variant="primary-soft" />
                <AirBadge v-if="selectedType.iata_code" :label="`IATA: ${selectedType.iata_code}`" variant="primary-soft" />
                <AirBadge :label="`Mfg: ${selectedType.manufacturer_id}`" variant="primary-soft" />
              </div>
              <div class="mt-3">
                <AirButton
                  :label="t('changeImage')"
                  size="sm"
                  variant="primary-soft"
                  @click="showImageModal = true"
                />
              </div>
            </div>
          </div>

          <hr class="border-border" />

          <!-- Specifications Sections -->
          <div class="grid gap-6 sm:grid-cols-2">
            <!-- General & Performance -->
            <div class="space-y-4">
              <h3 class="text-subtitle text-text-primary">
                General & Performance
              </h3>
              <dl class="grid grid-cols-2 gap-y-2 text-caption">
                <dt class="text-text-muted">
                  Price per unit
                </dt>
                <dd class="text-text-primary font-medium font-mono">
                  ${{ selectedType.price_per_unit?.toLocaleString() }}
                </dd>

                <dt class="text-text-muted">
                  Cruising Speed
                </dt>
                <dd class="text-text-primary font-medium">
                  {{ selectedType.cruising_speed_kph }} km/h
                </dd>

                <dt class="text-text-muted">
                  Max Range
                </dt>
                <dd class="text-text-primary font-medium">
                  {{ selectedType.max_range_km }} km
                </dd>

                <dt class="text-text-muted">
                  Min Runway
                </dt>
                <dd class="text-text-primary font-medium">
                  {{ selectedType.min_runway_length_m }} m
                </dd>

                <dt class="text-text-muted">
                  MTOW
                </dt>
                <dd class="text-text-primary font-medium">
                  {{ selectedType.mtow_kg?.toLocaleString() }} kg
                </dd>
              </dl>
            </div>

            <!-- Operations & Maintenance -->
            <div class="space-y-4">
              <h3 class="text-subtitle text-text-primary">
                Operations & Maintenance
              </h3>
              <dl class="grid grid-cols-2 gap-y-2 text-caption">
                <dt class="text-text-muted">
                  Max Seats
                </dt>
                <dd class="text-text-primary font-medium">
                  {{ selectedType.max_planned_seat_capacity }} pax
                </dd>

                <dt class="text-text-muted">
                  Hourly Fuel Burn
                </dt>
                <dd class="text-text-primary font-medium">
                  {{ selectedType.fuel_consumption_per_hour }} kg/h
                </dd>

                <dt class="text-text-muted">
                  Base Maint Points
                </dt>
                <dd class="text-text-primary font-medium">
                  {{ selectedType.base_maintenance_points }} pts
                </dd>

                <dt class="text-text-muted">
                  Base Turnaround
                </dt>
                <dd class="text-text-primary font-medium">
                  {{ selectedType.base_turnaround_points }} pts
                </dd>

                <dt class="text-text-muted">
                  Hourly Maint Cost
                </dt>
                <dd class="text-text-primary font-medium font-mono">
                  ${{ selectedType.maint_cost_per_flight_hour }}
                </dd>
              </dl>
            </div>

            <!-- Detailed Maintenance costs -->
            <div class="space-y-4 sm:col-span-2">
              <h3 class="text-subtitle text-text-primary">
                Additional Details
              </h3>
              <dl class="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-4 text-caption">
                <div class="flex flex-col">
                  <span class="text-text-muted">Cost per Landing</span>
                  <span class="text-text-primary font-medium font-mono">${{ selectedType.maint_cost_per_landing }}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-text-muted">Cost per Takeoff</span>
                  <span class="text-text-primary font-medium font-mono">${{ selectedType.maint_cost_per_takeoff }}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-text-muted">D-Check Interval</span>
                  <span class="text-text-primary font-medium">{{ selectedType.d_check_interval_fh?.toLocaleString() }} FH / {{ selectedType.d_check_interval_years }}y</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-text-muted">Overdue Multiplier</span>
                  <span class="text-text-primary font-medium">x{{ selectedType.d_check_overdue_multiplier }}</span>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col items-center justify-center py-16 text-center text-text-muted h-full">
          <span class="text-4xl">✈️</span>
          <p class="mt-4 text-body">
            Select an aircraft type to view specifications.
          </p>
        </div>
      </div>
    </div>

    <!-- Create Aircraft Type Modal -->
    <AdminAircraftTypeCreateModal
      :open="showCreateModal"
      :app-locale="appLocale"
      @close="showCreateModal = false"
      @created="handleCreated"
      @error="handleError"
    />

    <!-- Change Image Modal -->
    <AdminAircraftTypeImageModal
      :open="showImageModal"
      :app-locale="appLocale"
      :aircraft-type="selectedType"
      @close="showImageModal = false"
      @success="handleSuccess"
      @error="handleError"
    />
  </div>
</template>
