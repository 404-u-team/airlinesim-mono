<script setup lang="ts">
import { AirAircraftThumb, AirProgressBar, AirSelect } from "@airlinesim/air-ui";
import { Plane } from "@lucide/vue";

import type { FleetMessageKey } from "../i18n";
import type { OperationAircraftOption } from "../types";

const props = defineProps<{
  aircraftOptions: Array<{ label: string; value: string }>;
  selectedAircraftOption: OperationAircraftOption | undefined;
  t: (key: FleetMessageKey | string) => string;
  utilizationHours: number;
  utilizationPercent: number;
  utilizationTone: "primary" | "success" | "warning";
}>();

const selectedAircraftId = defineModel<string>({ required: true });
</script>

<template>
  <!-- Selected Aircraft Details & Utilization Card -->
  <section v-if="props.selectedAircraftOption" class="mt-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
    <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div class="flex items-center gap-3">
        <AirAircraftThumb
          v-if="props.selectedAircraftOption.aircraft.type?.image_url"
          :alt="props.selectedAircraftOption.aircraft.modelName"
          :image-url="props.selectedAircraftOption.aircraft.type.image_url"
          size="md"
        />
        <div v-else class="grid size-12 select-none place-items-center rounded-lg bg-primary/10 text-xl font-bold uppercase text-primary">
          {{ props.selectedAircraftOption.aircraft.modelName.slice(0, 3) }}
        </div>
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-subtitle font-bold text-text-primary">
              {{ props.selectedAircraftOption.aircraft.tail_number || "No Tail Number" }}
            </h2>
            <span class="rounded border border-border bg-surface px-2 py-0.5 text-caption font-semibold text-text-muted">
              {{ props.selectedAircraftOption.aircraft.modelName }}
            </span>
          </div>
          <p class="mt-1 text-caption text-text-muted">
            {{ props.t("market.base") }}: <strong class="text-text-primary">{{ props.selectedAircraftOption.aircraft.baseAirportName }}</strong> ·
            {{ props.t("aircraft.status") }}: <strong class="text-text-primary">{{ props.selectedAircraftOption.aircraft.status || "Active" }}</strong>
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-6">
        <div class="flex flex-col gap-1 min-w-40">
          <span class="text-caption text-text-muted font-medium">{{ props.t("operations.selectAircraft") }}</span>
          <AirSelect
            v-model="selectedAircraftId"
            label="Aircraft"
            :options="props.aircraftOptions"
          />
        </div>

        <div class="w-full shrink-0 md:max-w-xs">
          <div class="mb-1 flex items-center justify-between text-caption font-medium">
            <span class="text-text-muted">{{ props.t("operations.utilization") }}</span>
            <span class="font-bold text-text-primary">{{ props.utilizationHours.toFixed(1) }}{{ props.t("unit.hourShort") }} / 168{{ props.t("unit.hourShort") }} ({{ props.utilizationPercent }}%)</span>
          </div>
          <AirProgressBar :percent="props.utilizationPercent" :tone="props.utilizationTone" />
        </div>
      </div>
    </div>

    <!-- Compatibility alerts if any -->
    <div
      v-if="!props.selectedAircraftOption.compatible && props.selectedAircraftOption.blockers.length"
      class="mt-3 rounded-lg border border-error bg-error-bg p-3 text-caption text-error"
    >
      <strong class="mb-1 block">{{ props.t("operations.blockedConstraints") }}</strong>
      <ul class="list-disc pl-4 space-y-0.5">
        <li v-for="blocker in props.selectedAircraftOption.blockers" :key="blocker.code">
          {{ props.t('warning.' + blocker.code) || blocker.message }}
        </li>
      </ul>
    </div>
  </section>

  <!-- Empty Aircraft Selector Placeholder -->
  <section v-else class="mt-4 rounded-lg border border-border bg-surface p-6 shadow-sm flex flex-col items-center justify-center gap-4 text-center max-w-lg mx-auto">
    <div class="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
      <Plane class="size-6" />
    </div>
    <div>
      <h3 class="text-subtitle font-bold text-text-primary">
        {{ props.aircraftOptions.length ? props.t("operations.selectAircraft") : props.t("aircraft.empty.noAircraft") }}
      </h3>
      <p class="text-caption text-text-muted mt-1 max-w-sm">
        {{ props.aircraftOptions.length ? props.t("aircraft.empty.select") : props.t("aircraft.empty.buyFirst") }}
      </p>
    </div>
    <div v-if="props.aircraftOptions.length" class="w-64">
      <AirSelect
        v-model="selectedAircraftId"
        label="Aircraft"
        :options="props.aircraftOptions"
        class="w-full"
      />
    </div>
    <div v-else>
      <a href="/fleet/order/new" class="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-caption font-semibold text-on-primary transition hover:bg-primary/90">
        {{ props.t("market.title") }}
      </a>
    </div>
  </section>
</template>
