<template>
  <div>
    <h1>Мой Vue Сайт</h1>
    
    <SvelteWrapper 
        :createFn="createMap" 
      />
  </div>
</template>

<script setup lang="ts">
import { createMap } from 'map/Map';
import SvelteWrapper from './components/SvelteWrapper.vue';
</script>