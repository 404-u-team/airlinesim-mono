<template>
  <div>
    <h1>Мой Vue Сайт</h1>
    
    <SvelteWrapper 
      :mountFn="mountSvelte" 
      :svelteComponent="MapComponent"
    />
  </div>
</template>

<script setup>
// Импортируем универсальную функцию и сам компонент из микрофронтенда
import { mountSvelte, MapComponent } from 'map/Map';

// Импортируем нашу обертку
import SvelteWrapper from './SvelteWrapper.vue';
</script>