# AGENTS.md

Краткий контекст для будущих запусков агентов.

## Правила

- Использовать Bun как пакетный менеджер и runtime.
- Перед изменениями проверять этот файл и локальные README/STYLING документы.
- Не смешивать backend и frontend задачи без явной просьбы.
- Для frontend проверок использовать `bun run lint` из `frontend`.
- Для автоисправлений использовать `bun run lint:fix` из `frontend`; команда продолжает обходить остальные пакеты через Turbo даже после ошибки в одном пакете.
- Для изменений запускать применимые проверки: минимум `bun run lint` из `frontend`, а при наличии/добавлении более точечных тестов или storybook-проверок запускать соответствующие package scripts.
- Для workspace-скриптов полагаться на Turborepo.
- Любой frontend UI обязан поддерживать адаптивность и разные размеры экранов: desktop, tablet, mobile, узкие sidebar/topbar состояния и отсутствие горизонтального overflow.
- Любой новый пользовательский текст должен добавляться на двух языках (`en`, `ru`) в словарь приложения/feature, которая владеет этим UI. Shell-строки разделены по файлам `apps/shell/src/i18n/en.ts` и `apps/shell/src/i18n/ru.ts`, а `apps/shell/src/i18n/messages.ts` только собирает локали и экспортирует тип ключей. Shared контракт локалей и helper `translate` лежат в `packages/i18n`. Подробности и MFE-контракт: `docs/I18N.md`.
- При создании сложного корневого функционала, который меняет архитектурные правила или общий контракт между приложениями/пакетами, нужно создать отдельную понятную документацию в `docs/` на русском языке и добавить ссылку на нее в этот `AGENTS.md`. Документация должна объяснять контекст, источник истины, основные сценарии и правила для будущих агентов и людей.

## Структура

- `apps/shell` - Vue 3 + Vite host. Порт dev-сервера: `VITE_DEV_PORT_BASE` из `.env` (`4100` по умолчанию).
- `apps/map` - Svelte + Rsbuild remote. Порт dev-сервера: `VITE_DEV_PORT_BASE + 1` (`4101` по умолчанию).
- `apps/fleet-ops` - целевой Vue 3 remote для флота и операций.
- `apps/finance-stock` - целевой Vue remote для финансов и фондового рынка.
- `apps/network-planner` - целевой Vue 3 remote для маршрутной сети.
- `apps/events-news` - целевой Vue 3 remote для событий и новостей.
- `apps/hr-facilities` - целевой Vue 3 remote для HR и объектов.
- `bff` - Bun backend-for-frontend приложение, не MFE и не `apps/*`; модули для import/proxy живут в `bff/src/modules`, правила в `docs/bff.md`.
- `packages/air-ui` - Vue UI-kit, Tailwind theme tokens, Storybook.
- `packages/game-sdk` - клиентский SDK для backend API.
- `packages/eslint-config` - shared ESLint flat configs: `base`, `vue`, `svelte`.
- `packages/event-bus` - целевой shared package для cross-MFE pub/sub.
- `packages/api-contracts` - целевой shared package для OpenAPI -> TS types и Zod-схем.
- `docs/FE.png` - целевая MFE-архитектура.
- `docs/MFE-MF-CONNECT-EXAMPLE.png` - последовательность навигации Shell -> Vue Router -> Module Federation runtime -> remote app, включая кеширование remoteEntry и событие `mfe:ready`.
- `docs/MFE_EXAMPLE.png` - пример cross-MFE сценария через singleton `event-bus`: выбор рейса/самолета на карте, обработка в Shell и подготовка виджета Fleet & Ops.
- `docs/mfe-routing.md` - спецификация маршрутизации между Shell и MFE: источник истины для route registry, порядок портов, события `event-bus`, публичные auth routes и правила навигации remote-приложений.
- `docs/I18N.md` - спецификация мультиязычности RU/EN: источник локали, хранение строк, fallback и контракт Shell -> MFE.
- `docs/bff.md` - спецификация Bun BFF: отдельное расположение вне `apps`, модули `import` и `proxy`, env и правила развития.
- `docs/swagger.yaml` - OpenAPI/Swagger контракт backend API; `docs/swagger.json` лежит рядом как fallback для генерации.
- `docs/erd.txt` - доменная ERD модель.
- `docs/to-be-enabled.md` - матрица shell admin страниц: что уже включено по OpenAPI, какие ERD-сущности пока disabled и условия их включения.

## Архитектура

Shell лениво импортирует `World Map`, `Fleet & Ops`, `Finance & Stock`, `Network Planner`, `Events & News`, `HR & Facilities` через Module Federation. Remote-приложения должны использовать общие shared-библиотеки вместо локальных копий UI, API-клиентов и event-bus логики.

Целевые shared-пакеты из диаграммы: `event-bus`, `ui-kit`/`air-ui`, `api-contracts`, `game-sdk`.

Shell routing должен оставаться URL-driven: sidebar/topbar меняют route, Shell определяет lazy remote по route и уже затем Module Federation подгружает нужный MFE. Для межмодульных действий использовать singleton `@airlinesim/event-bus`; примеры событий есть в `docs/MFE_EXAMPLE.png`, актуальная спецификация маршрутизации - в `docs/mfe-routing.md`.

`packages/api-contracts` генерируется из `docs/swagger.yaml` / `docs/swagger.json` и экспортирует backend контракты для `game-sdk` и remotes. Корневой `bun run dev` должен запускать генерацию OpenAPI контрактов до старта Turbo dev.

Dev-порты приложений вычисляются из `VITE_DEV_PORT_BASE`: shell=`base`, map=`base+1`, fleet-ops=`base+2`, finance-stock=`base+3`, network-planner=`base+4`, events-news=`base+5`, hr-facilities=`base+6`. Для очистки занятых портов использовать `bun run ports:clear` из `frontend`.

BFF запускается отдельно из `frontend/bff` и не участвует в Module Federation. Это backend-for-frontend слой на Bun для импорта данных и proxy/composition endpoints; подробности в `docs/bff.md`.

## Styling

Все стили строятся через `@airlinesim/air-ui/styles` и Tailwind utilities. Цвета брать из semantic tokens в `packages/air-ui/src/styles/index.css`; локальные hex-цвета допустимы только при расширении самой темы.

Frontend разрабатывать атомарно: переиспользуемые кнопки, inputs, selects, badges, panels, controls и другие UI primitives выносить в `packages/air-ui`, экспортировать из `packages/air-ui/src/index.ts` и использовать в приложениях через `@airlinesim/air-ui`. Локальные компоненты приложения должны содержать композицию и доменную логику, а не дублировать атомарный UI.

Для каждого нового компонента в `packages/air-ui` обязательно создавать Storybook story рядом с компонентом (`*.stories.ts`). Story должна показывать базовый сценарий и важные состояния компонента: disabled/error/loading/variants/sizes, если они применимы.

Для новых UI-компонентов использовать шрифты, typography utilities и semantic tokens из `@airlinesim/air-ui/styles`. Не задавать локальные font-family, произвольные размеры типографики или hex-цвета в приложениях, если это не расширение темы внутри `air-ui`.

## Lint

Каждый пакет должен иметь:

```js
// eslint.config.js
import config from "@airlinesim/eslint-config/base";

export default config;
```

Для Vue использовать `/vue`, для Svelte использовать `/svelte`.
