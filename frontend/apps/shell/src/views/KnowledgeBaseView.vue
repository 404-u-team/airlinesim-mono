<script setup lang="ts">
import { AirBadge, AirButton, AirTextField } from "@airlinesim/air-ui";
import { type Locale, translate } from "@airlinesim/i18n";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { type ShellMessageKey, shellMessages } from "../i18n/messages";

type Article = {
  body: Record<Locale, string[]>;
  category: ShellMessageKey;
  id: string;
  title: Record<Locale, string>;
};

const props = defineProps<{
  appLocale: Locale;
}>();

const articles: Article[] = [
  {
    body: {
      en: [
        "Start by creating an airline and choosing a base airport. The base determines runway limits, slot capacity, night operations and early operating costs.",
        "After the dashboard opens, follow the next best action: buy an aircraft, plan a route, create a schedule, then monitor flights and finances.",
      ],
      ru: [
        "Начните с создания авиакомпании и выбора стартовой базы. База задает ограничения ВПП, слоты, ночные операции и первые операционные расходы.",
        "Откройте дашборд. Это ваш главный центр управления. Далее купите самолет, спланируйте маршрут, создайте расписание, затем следите за рейсами и финансами.",
      ],
    },
    category: "knowledge.category.guide",
    id: "first-run",
    title: { en: "First airline launch", ru: "Первый запуск авиакомпании" },
  },
  {
    body: {
      en: [
        "A good first base has enough runway for starter aircraft, useful daily slot capacity and flexible night operations.",
        "If an airport has short runway or low slot headroom, Fleet and Schedule screens may block or warn before purchase and activation.",
      ],
      ru: [
        "Хорошая первая база имеет достаточную ВПП для стартовых самолетов, полезный дневной запас слотов и гибкие ночные операции.",
        "Если у аэропорта короткая ВПП или мало слотов, Fleet и Schedule покажут блокер или предупреждение перед покупкой и активацией.",
      ],
    },
    category: "knowledge.category.concepts",
    id: "base-constraints",
    title: { en: "Base constraints", ru: "Ограничения базы" },
  },
  {
    body: {
      en: [
        "Open Fleet & Ops, compare price, range, seats, minimum runway and base compatibility, then run purchase preview before confirming.",
        "Keep enough cash after purchase for the first week of operations. Risk warnings do not always block purchase, but they explain what can go wrong.",
      ],
      ru: [
        "Откройте Fleet & Ops, сравните цену, дальность, места, минимальную ВПП и совместимость с базой, затем проверьте предпросмотр покупки.",
        "Оставьте достаточно денег после покупки на первую неделю операций. Риск не всегда блокирует покупку, но объясняет возможные последствия.",
      ],
    },
    category: "knowledge.category.guide",
    id: "first-aircraft",
    title: { en: "How to buy the first aircraft", ru: "Как купить первый самолет" },
  },
  {
    body: {
      en: [
        "Route Planner ranks destinations from your base by demand, distance, aircraft compatibility and estimated economics.",
        "Create the route when blockers are clear. A saved route appears on the dashboard map and becomes available for schedule planning.",
      ],
      ru: [
        "Планировщик маршрутов ранжирует направления из базы по спросу, дистанции, совместимости самолетов и примерной экономике.",
        "Создавайте маршрут, когда нет блокеров. Сохраненный маршрут появляется на карте дашборда и становится доступен для расписания.",
      ],
    },
    category: "knowledge.category.guide",
    id: "first-route",
    title: { en: "How to open the first route", ru: "Как открыть первый маршрут" },
  },
  {
    body: {
      en: [
        "A schedule assigns an aircraft to a route on selected weekdays and creates upcoming flights.",
        "Before activation, the system checks aircraft range, runway limits, slot headroom, night operations and basic conflicts.",
      ],
      ru: [
        "Расписание назначает самолет на маршрут в выбранные дни недели и создает будущие рейсы.",
        "Перед активацией система проверяет дальность самолета, ВПП, запас слотов, ночные операции и базовые конфликты.",
      ],
    },
    category: "knowledge.category.guide",
    id: "schedule",
    title: { en: "How to launch a schedule", ru: "Как запустить расписание" },
  },
  {
    body: {
      en: [
        "Finance combines current balance with the BFF operations ledger. Completed flights create revenue, fuel, airport fee and maintenance reserve entries.",
        "Route profitability needs completed flights. Before that, use route estimates as planning guidance, not final accounting.",
      ],
      ru: [
        "Финансы объединяют текущий баланс с журналом операций BFF. Завершенные рейсы создают выручку, топливо, аэропортовые сборы и резерв обслуживания.",
        "Прибыльность маршрута требует завершенных рейсов. До этого используйте прогноз маршрута как ориентир, а не финальный учет.",
      ],
    },
    category: "knowledge.category.concepts",
    id: "finance",
    title: { en: "How to read profitability", ru: "Как читать прибыльность" },
  },
];

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
  articles.find((article) => article.id === routeArticleId.value) ?? articles[0],
);
const filteredArticles = computed(() => {
  const query = search.value.trim().toLowerCase();

  if (!query) {
    return articles;
  }

  return articles.filter((article) =>
    [article.title[props.appLocale], ...article.body[props.appLocale]]
      .join(" ")
      .toLowerCase()
      .includes(query));
});

watch(
  () => route.params.article,
  (article) => {
    const articleId = Array.isArray(article) ? article[0] : article;
    if (articleId && !articles.some((item) => item.id === articleId)) {
      void router.replace("/knowledge-base");
    }
  },
  { immediate: true },
);

function openArticle(article: Article): void {
  void router.push(`/knowledge-base/${article.id}`);
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

      <article class="min-w-0 rounded-lg border border-border bg-surface p-5">
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
            {{ paragraph }}
          </p>
        </div>
        <div class="mt-6 flex flex-wrap gap-3">
          <AirButton
            :label="t('knowledge.openDashboard')"
            size="sm"
            variant="primary-soft"
            @click="router.push('/dashboard')"
          />
          <AirButton
            :label="t('knowledge.openFleet')"
            size="sm"
            variant="primary-soft"
            @click="router.push('/fleet/overview')"
          />
          <AirButton
            :label="t('knowledge.openRoutes')"
            size="sm"
            variant="primary-soft"
            @click="router.push('/airports/routes')"
          />
        </div>
      </article>
    </div>
  </main>
</template>
