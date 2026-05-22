<script setup lang="ts">
import { AirBadge, AirButton, AirFormPanel, AirTextField } from "@airlinesim/air-ui";
import { getLocaleLabel, type Locale, translate } from "@airlinesim/i18n";
import { Languages } from "@lucide/vue";
import { computed, reactive } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { authState, login, register } from "../auth";
import { type ShellMessageKey, shellMessages } from "../i18n/messages";
import { defaultRoutePath } from "../mfe-routing";

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
  email: "",
  login: "",
  nickname: "",
  password: "",
});

const isRegister = computed(() => route.name === "register");
const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);
const title = computed(() => (isRegister.value ? t.value("auth.title.register") : t.value("auth.title.login")));
const description = computed(() =>
  isRegister.value
    ? t.value("auth.description.register")
    : t.value("auth.description.login"),
);
const submitLabel = computed(() => (isRegister.value ? t.value("auth.submit.register") : t.value("auth.signIn")));
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

async function submit(): Promise<void> {
  try {
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

    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : defaultRoutePath;
    await router.replace(redirect);
  } catch {
    // Error state is owned by auth.ts so event-bus receives the same failure.
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
        <AirTextField
          v-if="isRegister"
          v-model="form.email"
          autocomplete="email"
          :label="t('auth.email')"
          name="email"
          required
          type="email"
        />
        <AirTextField
          v-if="isRegister"
          v-model="form.nickname"
          autocomplete="username"
          :hint="t('auth.nicknameHint')"
          :label="t('auth.nickname')"
          name="nickname"
          required
        />
        <AirTextField
          v-else
          v-model="form.login"
          autocomplete="username"
          :label="t('auth.login')"
          name="login"
          required
        />
        <AirTextField
          v-model="form.password"
          :autocomplete="isRegister ? 'new-password' : 'current-password'"
          :hint="t('auth.passwordHint')"
          :label="t('auth.password')"
          name="password"
          required
          type="password"
        />

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
        {{ switchLabel }}
        <RouterLink
          class="text-link hover:underline"
          :to="switchRoute"
        >
          {{ switchAction }}
        </RouterLink>
      </p>
    </AirFormPanel>
  </main>
</template>
