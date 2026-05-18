# AGENTS.md

Краткий контекст для будущих запусков агентов.

## Правила

- Использовать Bun как пакетный менеджер и runtime.
- Перед изменениями проверять этот файл и локальные README/STYLING документы.
- Не смешивать backend и frontend задачи без явной просьбы.
- Для frontend проверок использовать `bun run lint` из `frontend`.
- Для автоисправлений использовать `bun run lint:fix` из `frontend`; команда продолжает обходить остальные пакеты через Turbo даже после ошибки в одном пакете.
- Для workspace-скриптов полагаться на Turborepo.

## Структура

- `apps/shell` - Vue 3 + Vite host. Порт dev-сервера: `4000`.
- `apps/map` - Svelte + Rsbuild remote. Порт dev-сервера: `4001`.
- `apps/fleet-ops` - целевой Vue 3 remote для флота и операций.
- `apps/finance-stock` - целевой Vue remote для финансов и фондового рынка.
- `apps/network-planner` - целевой Vue 3 remote для маршрутной сети.
- `apps/events-news` - целевой Vue 3 remote для событий и новостей.
- `apps/hr-facilities` - целевой Vue 3 remote для HR и объектов.
- `packages/air-ui` - Vue UI-kit, Tailwind theme tokens, Storybook.
- `packages/game-sdk` - клиентский SDK для backend API.
- `packages/eslint-config` - shared ESLint flat configs: `base`, `vue`, `svelte`.
- `packages/event-bus` - целевой shared package для cross-MFE pub/sub.
- `packages/api-contracts` - целевой shared package для OpenAPI -> TS types и Zod-схем.
- `docs/FE.png` - целевая MFE-архитектура.
- `docs/erd.txt` - доменная ERD модель.

## Архитектура

Shell лениво импортирует `World Map`, `Fleet & Ops`, `Finance & Stock`, `Network Planner`, `Events & News`, `HR & Facilities` через Module Federation. Remote-приложения должны использовать общие shared-библиотеки вместо локальных копий UI, API-клиентов и event-bus логики.

Целевые shared-пакеты из диаграммы: `event-bus`, `ui-kit`/`air-ui`, `api-contracts`, `game-sdk`.

## Styling

Все стили строятся через `@airlinesim/air-ui/styles` и Tailwind utilities. Цвета брать из semantic tokens в `packages/air-ui/src/styles/index.css`; локальные hex-цвета допустимы только при расширении самой темы.

Frontend разрабатывать атомарно: переиспользуемые кнопки, inputs, selects, badges, panels, controls и другие UI primitives выносить в `packages/air-ui`, экспортировать из `packages/air-ui/src/index.ts` и использовать в приложениях через `@airlinesim/air-ui`. Локальные компоненты приложения должны содержать композицию и доменную логику, а не дублировать атомарный UI.

Для новых UI-компонентов использовать шрифты, typography utilities и semantic tokens из `@airlinesim/air-ui/styles`. Не задавать локальные font-family, произвольные размеры типографики или hex-цвета в приложениях, если это не расширение темы внутри `air-ui`.

## Lint

Каждый пакет должен иметь:

```js
// eslint.config.js
import config from "@airlinesim/eslint-config/base";

export default config;
```

Для Vue использовать `/vue`, для Svelte использовать `/svelte`.
