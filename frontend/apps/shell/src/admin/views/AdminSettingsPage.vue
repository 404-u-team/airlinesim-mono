<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { computed } from "vue";

import AppPreferences from "../../components/AppPreferences.vue";
import { adminText, type AdminTextKey } from "../i18n";

type AppTheme = "dark" | "light";

const props = defineProps<{
  appLocale: Locale;
  appTheme: AppTheme;
}>();

const emit = defineEmits<{
  "reset-system-preferences": [];
  "set-locale": [locale: Locale];
  "set-theme": [theme: AppTheme];
}>();

const at = computed(() => (key: AdminTextKey): string =>
  adminText(props.appLocale, key)
);
</script>

<template>
  <div class="h-full overflow-y-auto p-4 sm:p-6 space-y-6 bg-background">
    <!-- Header -->
    <header class="border-b border-border pb-4">
      <h1 class="text-h2 text-text-primary">
        {{ at("settings") }}
      </h1>
    </header>

    <div class="max-w-4xl">
      <AppPreferences
        :app-locale="props.appLocale"
        :app-theme="props.appTheme"
        @reset-system-preferences="emit('reset-system-preferences')"
        @set-locale="emit('set-locale', $event)"
        @set-theme="emit('set-theme', $event)"
      />
    </div>
  </div>
</template>
