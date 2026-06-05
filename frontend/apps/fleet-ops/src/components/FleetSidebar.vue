<script setup lang="ts">
import { AirBadge, AirButton, AirMetricCard, AirTextField } from "@airlinesim/air-ui";
import { computed } from "vue";

import type {
  FleetMarketAircraftType,
  FleetOwnedAircraftCard,
  FleetPurchasePreviewResponse,
  FleetReason,
} from "../types";

const props = defineProps<{
  canConfirmPurchase: boolean;
  editTailNumber: string;
  formatMoney: (value: number | undefined) => string;
  formatNumber: (value: number | undefined) => string;
  formatPercent: (value: number | undefined) => string;
  isConfirmingRisk: boolean;
  isPreviewLoading: boolean;
  isPurchasing: boolean;
  isTailSaving: boolean;
  ownedAircraft: FleetOwnedAircraftCard[];
  preview: FleetPurchasePreviewResponse | null;
  purchaseReasons: FleetReason[];
  reasonLabel: (reason: FleetReason) => string;
  requiresRiskAcknowledge: boolean;
  selectedAircraft: FleetOwnedAircraftCard | null;
  selectedType: FleetMarketAircraftType | null;
  t: (key: string) => string;
  tailNumber: string;
}>();

const emit = defineEmits<{
  "close-detail": [];
  "confirm-purchase": [];
  "load-market": [];
  "open-aircraft": [aircraft: FleetOwnedAircraftCard];
  "plan-route": [];
  "save-tail-number": [];
  "update-confirming-risk": [value: boolean];
  "update-edit-tail-number": [value: string];
  "update-tail-number": [value: string];
}>();

const confirmingRiskModel = computed({
  get: () => props.isConfirmingRisk,
  set: (value: boolean) => emit("update-confirming-risk", value),
});
const editTailNumberModel = computed({
  get: () => props.editTailNumber,
  set: (value: string) => emit("update-edit-tail-number", value),
});
const tailNumberModel = computed({
  get: () => props.tailNumber,
  set: (value: string) => emit("update-tail-number", value),
});
</script>

<template>
  <aside class="grid min-w-0 gap-5">
    <section class="rounded-lg border border-border bg-surface p-4">
      <h2 class="text-subtitle">
        {{ t("purchase.preview") }}
      </h2>
      <p
        v-if="!selectedType"
        class="mt-2 text-body text-text-muted"
      >
        {{ t("purchase.select") }}
      </p>

      <template v-else>
        <p class="mt-2 text-body text-text-muted">
          {{ selectedType.model_name }}
        </p>

        <AirTextField
          v-model="tailNumberModel"
          class="mt-4"
          :hint="preview?.tailNumber.suggestedPrefix ? `${t('tail.hint')} ${preview.tailNumber.suggestedPrefix}` : t('tail.hint')"
          :label="t('aircraft.tail')"
          :placeholder="t('tail.placeholder')"
        />

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <AirMetricCard
            :label="t('metric.price')"
            :value="formatMoney(preview?.aircraftPrice)"
          />
          <AirMetricCard
            :label="t('metric.remaining')"
            :tone="preview?.remainingBalance && preview.remainingBalance > 0 ? 'success' : 'danger'"
            :value="formatMoney(preview?.remainingBalance)"
          />
          <AirMetricCard
            :label="t('metric.reserve')"
            :tone="preview?.warnings.some((warning) => warning.code === 'FLEET_RESERVE_RISK') ? 'warning' : 'neutral'"
            :value="formatMoney(preview?.recommendedReserve)"
          />
          <AirMetricCard
            :label="t('metric.maintenance')"
            :value="`${formatMoney(preview?.estimatedDailyMaintenanceReserve)}/${t('unit.day')}`"
          />
        </div>

        <div
          v-if="purchaseReasons.length"
          class="mt-4 grid gap-2"
        >
          <div
            v-for="reason in purchaseReasons"
            :key="reason.code"
            class="rounded-lg border border-warning bg-warning-bg px-3 py-2 text-caption text-warning"
          >
            {{ reasonLabel(reason) }}
          </div>
        </div>

        <label
          v-if="requiresRiskAcknowledge"
          class="mt-4 flex items-start gap-2 text-caption text-text-muted"
        >
          <input
            v-model="confirmingRiskModel"
            class="mt-1"
            type="checkbox"
          />
          <span>{{ t("purchase.riskyAcknowledge") }}</span>
        </label>

        <div class="mt-4 rounded-lg border border-border bg-background p-3">
          <h3 class="text-subtitle">
            {{ t("purchase.confirm.title") }}
          </h3>
          <p class="mt-1 text-caption text-text-muted">
            {{ t("purchase.confirm.description") }}
          </p>
          <AirButton
            class="mt-4 w-full"
            :disabled="!canConfirmPurchase || isPreviewLoading"
            :label="isPurchasing ? t('purchase.confirm.title') : t('action.confirmPurchase')"
            @click="emit('confirm-purchase')"
          />
        </div>
      </template>
    </section>

    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-subtitle">
          {{ t("aircraft.owned") }}
        </h2>
        <AirButton
          :label="t('action.refresh')"
          size="sm"
          variant="primary-soft"
          @click="emit('load-market')"
        />
      </div>

      <div class="mt-3 grid gap-3">
        <article
          v-for="aircraft in ownedAircraft"
          :key="aircraft.id"
          class="rounded-lg border border-border bg-background p-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="truncate text-subtitle">
                {{ aircraft.tail_number || aircraft.id }}
              </h3>
              <p class="mt-1 truncate text-caption text-text-muted">
                {{ aircraft.modelName }}
              </p>
              <p class="mt-1 truncate text-caption text-text-muted">
                {{ aircraft.baseAirportName }}
              </p>
            </div>
            <AirBadge
              :label="aircraft.status || 'owned'"
              variant="primary-soft"
            />
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-caption text-text-muted">
            <span>{{ t("metric.maintenance") }} {{ formatPercent(aircraft.maintenanceRatio) }}</span>
            <span>{{ aircraft.in_service ? t("aircraft.inService") : t("aircraft.status") }}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <AirButton
              :label="t('action.openAircraft')"
              size="sm"
              variant="primary-soft"
              @click="emit('open-aircraft', aircraft)"
            />
            <AirButton
              :label="t('action.planRoute')"
              size="sm"
              variant="success"
              @click="emit('plan-route')"
            />
          </div>
        </article>

        <div
          v-if="ownedAircraft.length === 0"
          class="rounded-lg border border-border bg-background p-4"
        >
          <h3 class="text-subtitle">
            {{ t("aircraft.empty") }}
          </h3>
          <p class="mt-1 text-body text-text-muted">
            {{ t("aircraft.empty.description") }}
          </p>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-border bg-surface p-4">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-subtitle">
          {{ t("aircraft.detail.title") }}
        </h2>
        <AirButton
          v-if="selectedAircraft"
          :label="t('action.close')"
          size="sm"
          variant="primary-soft"
          @click="emit('close-detail')"
        />
      </div>

      <p
        v-if="!selectedAircraft"
        class="mt-2 text-body text-text-muted"
      >
        {{ t("aircraft.notSelected") }}
      </p>

      <div
        v-else
        class="mt-4 grid gap-4"
      >
        <div>
          <h3 class="truncate text-h3">
            {{ selectedAircraft.tail_number || selectedAircraft.id }}
          </h3>
          <p class="text-body text-text-muted">
            {{ selectedAircraft.modelName }} · {{ selectedAircraft.baseAirportName }}
          </p>
          <p class="mt-2 text-caption text-text-muted">
            {{ t("aircraft.assignment.pending") }}
          </p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <AirMetricCard
            :label="t('metric.range')"
            :value="`${formatNumber(selectedAircraft.type?.max_range_km)} ${t('unit.km')}`"
          />
          <AirMetricCard
            :label="t('metric.seats')"
            :value="formatNumber(selectedAircraft.type?.max_planned_seat_capacity)"
          />
          <AirMetricCard
            :label="t('metric.hours')"
            :value="formatNumber(selectedAircraft.total_flight_hours)"
          />
          <AirMetricCard
            :label="t('metric.cycles')"
            :value="formatNumber(selectedAircraft.total_cycles)"
          />
          <AirMetricCard
            :label="t('metric.maintenance')"
            :tone="selectedAircraft.maintenanceRatio < 0.35 ? 'warning' : 'success'"
            :value="formatPercent(selectedAircraft.maintenanceRatio)"
          />
          <AirMetricCard
            :label="t('metric.runway')"
            :value="`${formatNumber(selectedAircraft.type?.min_runway_length_m)} ${t('unit.m')}`"
          />
        </div>

        <div class="rounded-lg border border-border bg-background p-3">
          <AirTextField
            v-model="editTailNumberModel"
            :hint="t('tail.hint')"
            :label="t('aircraft.tail')"
          />
          <AirButton
            class="mt-3 w-full"
            :disabled="isTailSaving"
            :label="t('action.save')"
            size="sm"
            @click="emit('save-tail-number')"
          />
        </div>
      </div>
    </section>
  </aside>
</template>
