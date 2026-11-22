<script setup lang="ts">
import type { Locale } from "@airlinesim/i18n";

import { AirButton, AirTextField } from "@airlinesim/air-ui";
import { ApiRequestError } from "@airlinesim/game-sdk";
import { onMounted, ref } from "vue";

import { type ExternalProxySettings, getExternalProxySettings, updateExternalProxySettings } from "../api/externalProxyApi";
import { adminText, type AdminTextKey } from "../i18n";

const props = defineProps<{ appLocale: Locale }>();

const settings = ref<ExternalProxySettings>();
const proxyUrl = ref("");
const loading = ref(true);
const saving = ref(false);
const feedback = ref<AdminTextKey>();

async function load(): Promise<void> {
  loading.value = true;
  try {
    settings.value = await getExternalProxySettings();
  } catch {
    settings.value = undefined;
  } finally {
    loading.value = false;
  }
}

async function save(value: null | string): Promise<void> {
  try {
    settings.value = await updateExternalProxySettings(value);
    proxyUrl.value = "";
    feedback.value = "proxySaved";
  } catch (error) {
    feedback.value = error instanceof ApiRequestError && error.status === 400 ? "proxyInvalid" : "proxySaveError";
  } finally {
    saving.value = false;
  }
}

function submit(value: null | string): void {
  if (saving.value || value === "") {
    return;
  }
  saving.value = true;
  feedback.value = undefined;
  void save(value);
}

function t(key: AdminTextKey): string {
  return adminText(props.appLocale, key);
}

onMounted(load);
</script>

<template>
  <section class="min-w-0 space-y-4 rounded-lg border border-border bg-surface p-5">
    <div>
      <h2 class="text-subtitle">
        {{ t("proxyTitle") }}
      </h2>
      <p class="mt-1 text-body text-text-muted">
        {{ t("proxyDescription") }}
      </p>
    </div>

    <p v-if="loading" role="status" class="text-caption text-text-muted">
      {{ t("loading") }}
    </p>
    <div v-else-if="!settings" class="flex flex-wrap items-center gap-3">
      <p role="alert" class="text-caption text-error">
        {{ t("proxyLoadError") }}
      </p>
      <AirButton
        :label="t('refresh')"
        size="sm"
        variant="primary-soft"
        @click="load"
      />
    </div>

    <form v-else class="max-w-xl space-y-4" @submit.prevent="submit(proxyUrl.trim())">
      <p class="break-all text-caption text-text-muted">
        {{ t(settings.origin ? "proxyConfigured" : "proxyDisabled") }}
        <span v-if="settings.origin" class="ms-1 text-text-primary">{{ settings.origin }}</span>
      </p>
      <AirTextField
        v-model="proxyUrl"
        :disabled="saving"
        :error="feedback === 'proxyInvalid' ? t(feedback) : undefined"
        :hint="t('proxyHint')"
        :label="t('proxyUrl')"
        autocomplete="off"
        placeholder="http://proxy.example:3128"
        type="password"
        @update:model-value="feedback = undefined"
      />
      <div class="flex flex-wrap gap-2">
        <AirButton
          :disabled="saving || !proxyUrl.trim()"
          :label="t('save')"
          size="sm"
          type="submit"
        />
        <AirButton
          v-if="settings.origin"
          :disabled="saving"
          :label="t('proxyDisable')"
          size="sm"
          variant="primary-soft"
          @click="submit(null)"
        />
      </div>
      <p v-if="feedback === 'proxySaved'" role="status" class="text-caption text-success">
        {{ t(feedback) }}
      </p>
      <p v-if="feedback === 'proxySaveError'" role="alert" class="text-caption text-error">
        {{ t(feedback) }}
      </p>
    </form>
  </section>
</template>
