<template>
  <div class="h-screen">
    
    <SvelteWrapper 
        :createFn="createMap" 
        :componentProps="{rotation:true}"
      />
  </div>
</template>

<script setup lang="ts">
import { createMap } from 'map/Map';
import SvelteWrapper from './components/SvelteWrapper.vue';
import { api } from '@airlinesim/game-sdk';

api.login('super-secret-token-123');
console.log('Текущий токен в Shell:', api.getToken());
</script>