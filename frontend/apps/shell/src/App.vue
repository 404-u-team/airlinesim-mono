<script setup lang="ts">
import { airlineSimEventBus } from "@airlinesim/event-bus";
import {
  getStoredLocale,
  type Locale,
  LOCALE_STORAGE_KEY,
  normalizeLocale,
} from "@airlinesim/i18n";
import { onMounted, ref, watch } from "vue";
import { RouterView, useRoute } from "vue-router";

import AppSidebar from "./components/AppSidebar.vue";
import AppTopbar from "./components/AppTopbar.vue";

type AppTheme = "dark" | "light";

const THEME_STORAGE_KEY = "airlinesim:theme";

const isSidebarOpen = ref(false);
const locale = ref<Locale>("en");
const theme = ref<AppTheme>("light");
const companyName = "Air Avalon";
const route = useRoute();

function closeSidebar(): void {
  isSidebarOpen.value = false;
}

function getPreferredLocale(): Locale {
  return (
    getStoredLocale(window.localStorage) ??
    normalizeLocale(window.navigator.language)
  );
}

function getPreferredTheme(): AppTheme {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "dark" || storedTheme === "light") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resetSystemPreferences(): void {
  localStorage.removeItem(LOCALE_STORAGE_KEY);
  localStorage.removeItem(THEME_STORAGE_KEY);
  locale.value = getPreferredLocale();
  theme.value = getPreferredTheme();
}

function setLocale(nextLocale: Locale): void {
  locale.value = nextLocale;
}

function setTheme(nextTheme: AppTheme): void {
  theme.value = nextTheme;
}

function toggleLocale(): void {
  locale.value = locale.value === "en" ? "ru" : "en";
}

function toggleSidebar(): void {
  isSidebarOpen.value = !isSidebarOpen.value;
}

function toggleTheme(): void {
  theme.value = theme.value === "dark" ? "light" : "dark";
}

onMounted(() => {
  locale.value = getPreferredLocale();
  theme.value = getPreferredTheme();
});

watch(
  locale,
  (nextLocale) => {
    document.documentElement.lang = nextLocale;
    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    airlineSimEventBus.emit("i18n:locale-changed", { locale: nextLocale });
  },
  { immediate: true },
);

watch(
  theme,
  (nextTheme) => {
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  },
  { immediate: true },
);
</script>

<template>
  <RouterView
    v-if="route.meta.publicLayout"
    class="min-h-screen"
    :app-locale="locale"
    :app-theme="theme"
    @toggle-locale="toggleLocale"
  />
  <div
    v-else
    class="h-screen overflow-hidden bg-background text-body text-text-primary"
  >
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
        :app-locale="locale"
        :collapsed="!isSidebarOpen"
        :company-name="companyName"
        @toggle="toggleSidebar"
      />

      <div class="flex h-full min-w-0 flex-col overflow-hidden">
        <AppTopbar
          :app-locale="locale"
          :theme="theme"
          @toggle-locale="toggleLocale"
          @toggle-menu="toggleSidebar"
          @toggle-theme="toggleTheme"
        />
        <RouterView
          class="min-h-0 flex-1 overflow-hidden"
          :app-locale="locale"
          :app-theme="theme"
          @reset-system-preferences="resetSystemPreferences"
          @set-locale="setLocale"
          @set-theme="setTheme"
        />
      </div>
    </div>
  </div>
</template>
