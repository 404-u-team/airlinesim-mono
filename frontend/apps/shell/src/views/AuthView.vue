<script setup lang="ts">
import { AirBadge, AirButton, AirFormPanel, AirTextField } from "@airlinesim/air-ui";
import { getLocaleLabel, type Locale, translate } from "@airlinesim/i18n";
import { Languages } from "@lucide/vue";
import { computed, reactive } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { authState, createMyAirline, login, register } from "../auth";
import StartingAirportPicker from "../components/StartingAirportPicker.vue";
import { type ShellMessageKey, shellMessages } from "../i18n/messages";
import { defaultRoutePath } from "../mfe-routing";
import { getOnboardingSession } from "../onboarding/api";

const props = defineProps<{
  appLocale: Locale;
}>();

defineEmits<{
  "toggle-locale": [];
}>();

const route = useRoute();
const router = useRouter();
const { error, isSubmitting } = authState;

const form = reactive({
  airlineIataCode: "",
  airlineIcaoCode: "",
  airlineName: "",
  airlineStartingAirportId: "",
  email: "",
  login: "",
  nickname: "",
  password: "",
});

const isExpired = computed(() => route.query.expired === "true");

const isCreatingAirline = computed(() => route.name === "onboarding-airline");

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);
const title = computed(() => {
  if (isCreatingAirline.value) {
    return t.value("airline.create.title");
  }

  return isRegister.value ? t.value("auth.title.register") : t.value("auth.title.login");
});
const description = computed(() => {
  if (isCreatingAirline.value) {
    return t.value("airline.create.description");
  }

  return isRegister.value
    ? t.value("auth.description.register")
    : t.value("auth.description.login");
});
const submitLabel = computed(() => {
  if (isCreatingAirline.value) {
    return t.value("airline.create.submit");
  }

  return isRegister.value ? t.value("auth.submit.register") : t.value("auth.signIn");
});
const switchLabel = computed(() =>
  isRegister.value ? t.value("auth.switch.signIn") : t.value("auth.needAccount"),
);
const switchRoute = computed(() => (isRegister.value ? "/login" : "/register"));
const switchAction = computed(() => (isRegister.value ? t.value("auth.signIn") : t.value("auth.register")));
const translatedError = computed(() => {
  if (!error.value) {
    return "";
  }

  return error.value in shellMessages.en
    ? t.value(error.value as ShellMessageKey)
    : error.value;
});

const isRegister = computed(() => route.name === "register");

async function completeAuth(): Promise<void> {
  try {
    const session = await getOnboardingSession();
    await router.replace(session.recommendedNextRoute || defaultRoutePath);
  } catch {
    await router.replace(defaultRoutePath);
  }
}

async function submit(): Promise<void> {
  try {
    if (isCreatingAirline.value) {
      // Input sanitization
      form.airlineIataCode = form.airlineIataCode.toUpperCase();
      form.airlineIcaoCode = form.airlineIcaoCode.toUpperCase();

      await createMyAirline({
        iata_code: form.airlineIataCode,
        icao_code: form.airlineIcaoCode,
        name: form.airlineName,
        starting_airport_id: form.airlineStartingAirportId || undefined,
      });
      await completeAuth();
      return;
    }

    if (isRegister.value) {
      await register({
        email: form.email,
        nickname: form.nickname,
        password: form.password,
      });
    } else {
      await login({
        login: form.login,
        password: form.password,
      });
    }

    if (!authState.airline.value) {
      await router.replace("/onboarding/airline");
      return;
    }

    await completeAuth();
  } catch {
    // Error state is owned by auth.ts
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-text-primary">
    <button
      class="absolute right-4 top-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-body text-text-primary transition hover:bg-surface-subtle"
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

    <AirFormPanel
      :description="description"
      :title="title"
    >
      <template #eyebrow>
        <AirBadge
          class="mb-3"
          label="AirlineSim"
          variant="primary-soft"
        />
      </template>

      <form
        class="space-y-4"
        @submit.prevent="submit"
      >
        <template v-if="isCreatingAirline">
          <AirTextField
            v-model="form.airlineName"
            autocomplete="organization"
            :label="t('airline.name')"
            name="airlineName"
            required
          />
          <div class="grid gap-4 sm:grid-cols-2">
            <AirTextField
              v-model="form.airlineIataCode"
              autocomplete="off"
              :hint="t('airline.iataHint')"
              :label="t('airline.iataCode')"
              maxlength="2"
              name="airlineIataCode"
              required
            />
            <AirTextField
              v-model="form.airlineIcaoCode"
              autocomplete="off"
              :hint="t('airline.icaoHint')"
              :label="t('airline.icaoCode')"
              maxlength="3"
              name="airlineIcaoCode"
              required
            />
          </div>
          <StartingAirportPicker
            v-model="form.airlineStartingAirportId"
            :app-locale="props.appLocale"
          />
        </template>

        <AirTextField
          v-if="isRegister && !isCreatingAirline"
          v-model="form.email"
          autocomplete="email"
          :label="t('auth.email')"
          name="email"
          required
          type="email"
        />
        <AirTextField
          v-if="isRegister && !isCreatingAirline"
          v-model="form.nickname"
          autocomplete="username"
          :hint="t('auth.nicknameHint')"
          :label="t('auth.nickname')"
          name="nickname"
          required
        />
        <AirTextField
          v-if="!isRegister && !isCreatingAirline"
          v-model="form.login"
          autocomplete="username"
          :label="t('auth.login')"
          name="login"
          required
        />
        <AirTextField
          v-if="!isCreatingAirline"
          v-model="form.password"
          :autocomplete="isRegister ? 'new-password' : 'current-password'"
          :hint="t('auth.passwordHint')"
          :label="t('auth.password')"
          name="password"
          required
          type="password"
        />

        <p
          v-if="isExpired && !error"
          class="rounded-lg bg-warning/10 px-3 py-2 text-body text-warning"
        >
          {{ t("auth.expiredSession") }}
        </p>

        <p
          v-if="error"
          class="rounded-lg bg-error-bg px-3 py-2 text-body text-error"
        >
          {{ translatedError }}
        </p>

        <AirButton
          class="w-full"
          :disabled="isSubmitting"
          :label="isSubmitting ? t('auth.submitting') : submitLabel"
          type="submit"
        />
      </form>

      <p class="mt-5 text-center text-body text-text-muted">
        <template v-if="!isCreatingAirline">
          {{ switchLabel }}
          <RouterLink
            class="text-link hover:underline"
            :to="switchRoute"
          >
            {{ switchAction }}
          </RouterLink>
        </template>
      </p>
    </AirFormPanel>
  </main>
</template>
