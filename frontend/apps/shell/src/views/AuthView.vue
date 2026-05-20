<script setup lang="ts">
import { AirBadge, AirButton, AirFormPanel, AirTextField } from "@airlinesim/air-ui";
import { computed, reactive } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

import { authState, login, register } from "../auth";
import { defaultRoutePath } from "../mfe-routing";

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
const title = computed(() => (isRegister.value ? "Create airline account" : "Sign in"));
const description = computed(() =>
  isRegister.value
    ? "Register a player profile and start a new airline session."
    : "Use your captain credentials to continue the simulation.",
);
const submitLabel = computed(() => (isRegister.value ? "Create account" : "Sign in"));
const switchLabel = computed(() =>
  isRegister.value ? "Already have an account?" : "Need an account?",
);
const switchRoute = computed(() => (isRegister.value ? "/login" : "/register"));
const switchAction = computed(() => (isRegister.value ? "Sign in" : "Register"));

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
    <AirFormPanel
      :description="description"
      :title="title"
    >
      <template #eyebrow>
        <AirBadge
          class="mb-3"
          label="AirlineSim Korea"
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
          label="Email"
          name="email"
          required
          type="email"
        />
        <AirTextField
          v-if="isRegister"
          v-model="form.nickname"
          autocomplete="username"
          hint="3-50 characters."
          label="Nickname"
          name="nickname"
          required
        />
        <AirTextField
          v-else
          v-model="form.login"
          autocomplete="username"
          label="Login"
          name="login"
          required
        />
        <AirTextField
          v-model="form.password"
          :autocomplete="isRegister ? 'new-password' : 'current-password'"
          hint="8-72 characters."
          label="Password"
          name="password"
          required
          type="password"
        />

        <p
          v-if="error"
          class="rounded-lg bg-error-bg px-3 py-2 text-body text-error"
        >
          {{ error }}
        </p>

        <AirButton
          class="w-full"
          :disabled="isSubmitting"
          :label="isSubmitting ? 'Please wait...' : submitLabel"
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
