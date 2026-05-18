<script setup lang="ts">
import { ref } from "vue";
import { RouterView } from "vue-router";

import AppSidebar from "./components/AppSidebar.vue";
import AppTopbar from "./components/AppTopbar.vue";

const isSidebarOpen = ref(false);
const companyName = "Air Avalon";

function closeSidebar(): void {
  isSidebarOpen.value = false;
}

function toggleSidebar(): void {
  isSidebarOpen.value = !isSidebarOpen.value;
}
</script>

<template>
  <div class="h-screen overflow-hidden bg-background text-body text-text-primary">
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 z-30 bg-text-primary/30 lg:hidden"
      @click="closeSidebar"
    />

    <div
      class="grid h-screen grid-cols-1 transition-[grid-template-columns] duration-200 ease-out overflow-hidden"
      :class="isSidebarOpen ? 'lg:grid-cols-[256px_1fr]' : 'lg:grid-cols-[64px_1fr]'"
    >
      <AppSidebar
        :collapsed="!isSidebarOpen"
        :company-name="companyName"
        @toggle="toggleSidebar"
      />

      <div class="flex h-full min-w-0 flex-col overflow-hidden">
        <AppTopbar @toggle-menu="toggleSidebar" />
        <RouterView class="min-h-0 flex-1 overflow-hidden" />
      </div>
    </div>
  </div>
</template>
