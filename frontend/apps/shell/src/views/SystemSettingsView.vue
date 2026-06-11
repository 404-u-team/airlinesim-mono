<script setup lang="ts">
import { type Locale, translate } from "@airlinesim/i18n";
import { computed } from "vue";

import AppPreferences from "../components/AppPreferences.vue";
import { type ShellMessageKey, shellMessages } from "../i18n/messages";

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

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);
</script>

<template>
  <main class="h-full overflow-y-auto bg-background p-4 text-text-primary sm:p-6 lg:p-8">
    <div class="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 class="text-h2">
          {{ t("system.title") }}
        </h1>
      </header>

      <AppPreferences
        :app-locale="props.appLocale"
        :app-theme="props.appTheme"
        @reset-system-preferences="emit('reset-system-preferences')"
        @set-locale="emit('set-locale', $event)"
        @set-theme="emit('set-theme', $event)"
      />
    </div>
  </main>
</template>
