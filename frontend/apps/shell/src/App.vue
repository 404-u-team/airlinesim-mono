<script setup lang="ts">
import { createMap } from "map/Map";

import SvelteWrapper from "./components/SvelteWrapper.vue";
</script>

<template>
  <div class="h-screen">
    <SvelteWrapper
      :create-fn="createMap"
      :component-props="{ rotation: true }"
    />
  </div>
</template>
