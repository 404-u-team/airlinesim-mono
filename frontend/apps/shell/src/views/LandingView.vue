<script setup lang="ts">
import { AirBadge, AirButton, AirIconButton } from "@airlinesim/air-ui";
import { getLocaleLabel, type Locale, translate } from "@airlinesim/i18n";
import { Languages, Moon, Sun } from "@lucide/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import SvelteWrapper from "../components/SvelteWrapper.vue";
import { type ShellMessageKey, shellMessages } from "../i18n/messages";
import { buildLandingMapState } from "../landing/mock-map-state";

const props = defineProps<{
  appLocale: Locale;
  appTheme: "dark" | "light";
}>();

defineEmits<{
  "toggle-locale": [];
  "toggle-theme": [];
}>();

const router = useRouter();

const windowWidth = ref(1024);
const isDesktop = computed(() => windowWidth.value >= 1024);

const handleResize = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  windowWidth.value = window.innerWidth;
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  window.removeEventListener("resize", handleResize);
});

// Глобус - это remote MFE map с мок-данными: rotation=true вращает глобус и
// отключает интерактивность внутри map-manager.
const baseLandingMapState = buildLandingMapState();

const mapComponentProps = computed(() => ({
  controls: false,
  mapState: {
    ...baseLandingMapState,
    viewport: {
      ...baseLandingMapState.viewport,
      zoom: isDesktop.value ? 2.2 : 1.0,
    },
  },
  rotation: true,
  theme: props.appTheme,
}));

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);

const themeLabel = computed(() =>
  props.appTheme === "dark" ? t.value("topbar.theme.light") : t.value("topbar.theme.dark"),
);

const createMap = async (
  target: HTMLElement,
  componentProps: Record<string, unknown>,
): Promise<ReturnType<typeof import("map/Map")["createMap"]>> => {
  const remote = await import("map/Map");

  return remote.createMap(target, componentProps);
};

async function goToLogin(): Promise<void> {
  await router.push("/login");
}
</script>

<template>
  <main class="relative min-h-screen overflow-hidden bg-background text-text-primary">
    <!-- Глобус: на desktop половина уходит за левый край, на mobile - фон снизу. -->
    <div
      class="pointer-events-none absolute left-1/2 top-[45vh] size-[300vw] -translate-x-1/2 opacity-50 lg:left-[-140vmin] lg:top-1/2 lg:size-[300vmin] lg:-translate-x-0 lg:-translate-y-1/2 lg:opacity-100"
      aria-hidden="true"
    >
      <SvelteWrapper
        :component-props="mapComponentProps"
        :create-fn="createMap"
      />
    </div>

    <header class="absolute right-4 top-4 z-10 flex items-center gap-2">
      <AirIconButton
        :label="themeLabel"
        @click="$emit('toggle-theme')"
      >
        <Sun
          v-if="appTheme === 'dark'"
          :size="16"
          aria-hidden="true"
        />
        <Moon
          v-else
          :size="16"
          aria-hidden="true"
        />
      </AirIconButton>
      <button
        class="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-body text-text-primary transition hover:bg-surface-subtle"
        type="button"
        :aria-label="t('topbar.language')"
        :title="t('topbar.language')"
        @click="$emit('toggle-locale')"
      >
        <Languages
          :size="16"
          aria-hidden="true"
        />
        <span>{{ getLocaleLabel(props.appLocale) }}</span>
      </button>
    </header>

    <div
      class="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 pb-[50vw] pt-20 sm:px-10 lg:justify-end lg:pb-0 lg:pt-0"
    >
      <section class="max-w-xl space-y-6 text-center lg:text-left">
        <AirBadge
          :label="t('landing.badge')"
          variant="primary-soft"
        />
        <h1 class="text-h1 sm:text-[56px]">
          AirlineSim
        </h1>
        <p class="text-h4 text-text-primary">
          {{ t("landing.tagline") }}
        </p>
        <p class="text-subtitle text-text-muted">
          {{ t("landing.description") }}
        </p>
        <div class="flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
          <AirButton
            :label="t('auth.signIn')"
            size="lg"
            @click="goToLogin"
          />
          <RouterLink
            class="text-subtitle text-link hover:underline"
            to="/register"
          >
            {{ t("landing.register") }}
          </RouterLink>
        </div>
      </section>
    </div>
  </main>
</template>
