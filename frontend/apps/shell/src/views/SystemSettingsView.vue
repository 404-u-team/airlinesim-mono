<script setup lang="ts">
import { AirButton } from "@airlinesim/air-ui";
import {
  getLocaleLabel,
  type Locale,
  SUPPORTED_LOCALES,
  translate,
} from "@airlinesim/i18n";
import { Languages, MonitorCog, Moon, RotateCcw, Sun } from "@lucide/vue";
import { computed } from "vue";

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

const localeOptions = computed(() =>
  SUPPORTED_LOCALES.map((locale) => ({
    label: t.value(locale === "ru" ? "system.locale.ru" : "system.locale.en"),
    shortLabel: getLocaleLabel(locale),
    value: locale,
  })),
);

const themeOptions = computed(() => [
  {
    icon: Sun,
    label: t.value("system.theme.light"),
    value: "light" as const,
  },
  {
    icon: Moon,
    label: t.value("system.theme.dark"),
    value: "dark" as const,
  },
]);
</script>

<template>
  <main class="h-full overflow-y-auto bg-background p-4 text-text-primary sm:p-6 lg:p-8">
    <div class="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 class="text-h2">
          {{ t("system.title") }}
        </h1>
      </header>

      <section class="rounded-lg border border-border bg-surface">
        <div class="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-on-primary-soft">
              <MonitorCog :size="20" />
            </div>
            <div class="min-w-0">
              <h2 class="text-subtitle">
                {{ t("system.theme.title") }}
              </h2>
              <p class="mt-1 max-w-2xl text-body text-text-muted">
                {{ t("system.theme.description") }}
              </p>
            </div>
          </div>

          <div class="inline-grid grid-cols-2 rounded-lg border border-border bg-surface-subtle p-1">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              class="inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-body transition"
              :class="props.appTheme === option.value ? 'bg-primary text-on-primary shadow-sm' : 'text-text-muted hover:text-text-primary'"
              type="button"
              :aria-pressed="props.appTheme === option.value"
              @click="emit('set-theme', option.value)"
            >
              <component
                :is="option.icon"
                :size="16"
                aria-hidden="true"
              />
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-4 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-on-primary-soft">
              <Languages :size="20" />
            </div>
            <div class="min-w-0">
              <h2 class="text-subtitle">
                {{ t("system.language.title") }}
              </h2>
              <p class="mt-1 max-w-2xl text-body text-text-muted">
                {{ t("system.language.description") }}
              </p>
            </div>
          </div>

          <div class="inline-grid grid-cols-2 rounded-lg border border-border bg-surface-subtle p-1">
            <button
              v-for="option in localeOptions"
              :key="option.value"
              class="inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-md px-3 text-body transition"
              :class="props.appLocale === option.value ? 'bg-primary text-on-primary shadow-sm' : 'text-text-muted hover:text-text-primary'"
              type="button"
              :aria-pressed="props.appLocale === option.value"
              @click="emit('set-locale', option.value)"
            >
              <span class="text-monospace">{{ option.shortLabel }}</span>
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-on-primary-soft">
              <RotateCcw :size="20" />
            </div>
            <div class="min-w-0">
              <h2 class="text-subtitle">
                {{ t("system.reset.title") }}
              </h2>
              <p class="mt-1 max-w-2xl text-body text-text-muted">
                {{ t("system.reset.description") }}
              </p>
            </div>
          </div>

          <AirButton
            :label="t('system.reset')"
            size="sm"
            variant="primary-soft"
            @click="emit('reset-system-preferences')"
          />
        </div>
      </section>
    </div>
  </main>
</template>
