<script setup lang="ts">
import type { CalibrationParams } from "../types";

defineProps<{
  params: CalibrationParams;
}>();
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full border-collapse text-left text-body">
      <thead>
        <tr class="border-b border-border text-text-muted text-caption uppercase">
          <th class="py-2 px-3">
            Parameter
          </th>
          <th class="py-2 px-3 text-right">
            Value
          </th>
          <th class="py-2 px-3">
            Description
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border">
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            baseScale
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.baseScale.toFixed(4) }}
          </td>
          <td class="py-2 px-3 text-text-muted">
            Global demand scale multiplier (replaces K)
          </td>
        </tr>
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            gdpElasticity
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.gdpElasticity.toFixed(3) }}
          </td>
          <td class="py-2 px-3 text-text-muted">
            Sensitivity to regional GDP per capita
          </td>
        </tr>
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            populationElasticity
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.populationElasticity.toFixed(3) }}
          </td>
          <td class="py-2 px-3 text-text-muted">
            Sensitivity to catchment population
          </td>
        </tr>
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            distanceD0
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.distanceD0 }} km
          </td>
          <td class="py-2 px-3 text-text-muted">
            Distance half-decay parameter
          </td>
        </tr>
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            distanceP
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.distanceP.toFixed(2) }}
          </td>
          <td class="py-2 px-3 text-text-muted">
            Distance decay power exponent
          </td>
        </tr>
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            affinityBase
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.affinityBase.toFixed(2) }}
          </td>
          <td class="py-2 px-3 text-text-muted">
            Base affinity baseline (no specific pull)
          </td>
        </tr>
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            affinityBusiness
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.affinityBusiness.toFixed(2) }}
          </td>
          <td class="py-2 px-3 text-text-muted">
            Business travel affinity multiplier
          </td>
        </tr>
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            affinityTourism
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.affinityTourism.toFixed(2) }}
          </td>
          <td class="py-2 px-3 text-text-muted">
            Tourism travel affinity multiplier
          </td>
        </tr>
        <tr>
          <td class="py-2 px-3 font-mono text-primary font-medium">
            affinityDiaspora
          </td>
          <td class="py-2 px-3 text-right font-semibold">
            {{ params.affinityDiaspora.toFixed(2) }}
          </td>
          <td class="py-2 px-3 text-text-muted">
            Diaspora/migrant corridor affinity multiplier
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
