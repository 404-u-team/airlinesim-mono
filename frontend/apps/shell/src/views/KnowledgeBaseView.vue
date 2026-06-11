<script setup lang="ts">
import { AirBadge, AirButton, AirTextField } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import type { DashboardSummary } from "../dashboard/types";
import type { FuelPriceSnapshot } from "../fuel/types";

import { getDashboardSummary } from "../dashboard/api";
import { getFuelPrice } from "../fuel/api";
import { type ShellMessageKey, shellMessages } from "../i18n/messages";
import { type KnowledgeArticle, knowledgeArticles } from "../knowledge/articles";
import {
  buildKnowledgePlaceholders,
  knowledgeBadgeClass,
  knowledgeParagraphSegments,
  type KnowledgeSegment,
} from "../knowledge/placeholders";

const props = defineProps<{
  appLocale: Locale;
}>();

const summary = ref<DashboardSummary | null>(null);
const fuelPrice = ref<FuelPriceSnapshot | null>(null);
const isLoadingSummary = ref(false);

const route = useRoute();
const router = useRouter();
const search = ref("");

const t = computed(() => (key: ShellMessageKey): string =>
  translate(shellMessages, props.appLocale, key),
);
const routeArticleId = computed(() => {
  const value = route.params.article;

  return Array.isArray(value) ? value[0] : value;
});
const selectedArticle = computed(() =>
  knowledgeArticles.find((article) => article.id === routeArticleId.value) ?? knowledgeArticles[0],
);
const filteredArticles = computed(() => {
  const query = search.value.trim().toLowerCase();

  if (!query) {
    return knowledgeArticles;
  }

  return knowledgeArticles.filter((article) =>
    [article.title[props.appLocale], ...article.body[props.appLocale]]
      .join(" ")
      .toLowerCase()
      .includes(query));
});
const placeholders = computed(() =>
  buildKnowledgePlaceholders(props.appLocale, summary.value, fuelPrice.value),
);

onMounted(async () => {
  isLoadingSummary.value = true;
  try {
    const [summaryRes, fuelRes] = await Promise.all([
      getDashboardSummary(),
      getFuelPrice().catch(() => null),
    ]);
    summary.value = summaryRes;
    fuelPrice.value = fuelRes;
  } catch (err) {
    console.error("Failed to load dashboard summary for interactive guide", err);
  } finally {
    isLoadingSummary.value = false;
  }
});

watch(
  () => route.params.article,
  (article) => {
    const articleId = Array.isArray(article) ? article[0] : article;
    if (articleId && !knowledgeArticles.some((item) => item.id === articleId)) {
      void router.replace("/knowledge-base");
    }
  },
  { immediate: true },
);

function openArticle(article: KnowledgeArticle): void {
  void router.push(`/knowledge-base/${article.id}`);
}

function paragraphSegments(paragraph: string): KnowledgeSegment[] {
  return knowledgeParagraphSegments(paragraph, placeholders.value);
}
</script>

<template>
  <main class="h-full overflow-y-auto bg-background p-4 text-body text-text-primary sm:p-6">
    <div class="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <aside class="min-w-0 rounded-lg border border-border bg-surface p-4">
        <h1 class="text-h2">
          {{ t("knowledge.title") }}
        </h1>
        <p class="mt-2 text-body text-text-muted">
          {{ t("knowledge.subtitle") }}
        </p>
        <AirTextField
          v-model="search"
          class="mt-4"
          :label="t('knowledge.search')"
          :placeholder="t('knowledge.searchPlaceholder')"
        />
        <div class="mt-4 grid gap-2">
          <button
            v-for="article in filteredArticles"
            :key="article.id"
            class="rounded-lg border p-3 text-left transition hover:bg-surface-subtle"
            :class="selectedArticle.id === article.id ? 'border-primary bg-primary-soft text-on-primary-soft' : 'border-border'"
            type="button"
            @click="openArticle(article)"
          >
            <span class="block text-caption text-text-muted">
              {{ t(article.category) }}
            </span>
            <strong class="mt-1 block text-subtitle">
              {{ article.title[props.appLocale] }}
            </strong>
          </button>
          <p
            v-if="filteredArticles.length === 0"
            class="rounded-lg border border-border p-4 text-text-muted"
          >
            {{ t("knowledge.empty") }}
          </p>
        </div>
      </aside>

      <article class="min-w-0 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
        <div>
          <AirBadge
            :label="t(selectedArticle.category)"
            variant="warning-soft"
          />
          <h2 class="mt-4 text-h2">
            {{ selectedArticle.title[props.appLocale] }}
          </h2>
          <div class="mt-5 grid gap-4 text-body leading-7 text-text-primary">
            <p
              v-for="paragraph in selectedArticle.body[props.appLocale]"
              :key="paragraph"
            >
              <template
                v-for="(segment, index) in paragraphSegments(paragraph)"
                :key="index"
              >
                <span
                  v-if="segment.kind === 'badge'"
                  :class="knowledgeBadgeClass(segment.tone)"
                >{{ segment.text }}</span>
                <strong
                  v-else-if="segment.kind === 'strong'"
                  class="text-text-primary font-medium"
                >{{ segment.text }}</strong>
                <template v-else>
                  {{ segment.text }}
                </template>
              </template>
            </p>
          </div>
        </div>

        <div
          v-if="selectedArticle.links && selectedArticle.links.length"
          class="mt-8 border-t border-border pt-4"
        >
          <div class="flex flex-wrap gap-3">
            <AirButton
              v-for="link in selectedArticle.links"
              :key="link.path"
              :label="link.label[props.appLocale]"
              size="sm"
              variant="primary-soft"
              @click="router.push(link.path)"
            />
          </div>
        </div>
      </article>
    </div>
  </main>
</template>
