<template>
  <div class="h-screen">
    
    <SvelteWrapper 
        :createFn="createMap" 
      />
  </div>
</template>

<script setup lang="ts">
import { createMap } from 'map/Map';
import SvelteWrapper from './components/SvelteWrapper.vue';
</script>