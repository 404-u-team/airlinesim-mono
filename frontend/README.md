# Airlinesim Frontend

Фронтенд монорепозитория Airlinesim построен как набор приложений и shared-пакетов на Bun workspaces и Turborepo. Основной сценарий: shell-приложение поднимает общий каркас игры, а функциональные зоны подключаются как remote-модули через Module Federation.

## Технологии

- Bun - пакетный менеджер и runtime для всех JS/TS задач.
- Turborepo - оркестрация `dev`, `build`, `lint` по workspace-пакетам.
- Vue 3 + Vite - shell/host и основные Vue remote-приложения.
- Svelte 5 + Rsbuild - map remote, где важна производительность интерактивной карты.
- Module Federation - lazy import remote-приложений в host.
- Tailwind CSS 4 - styling через токены дизайн-системы `@airlinesim/air-ui`.
- Storybook - документация и визуальная проверка компонентов `air-ui`.
- TypeScript - строгая типизация приложений, SDK и конфигов.
- ESLint flat config - общий строгий lint слой из `@airlinesim/eslint-config`.

## Команды

```bash
bun install
bun run dev
bun run lint
bun run lint:fix
bun run check
```

`bun run lint` запускает `turbo lint` и проходит каждый workspace-пакет, где есть `lint`-скрипт.
`bun run lint:fix` запускает `turbo run lint:fix --continue=always --force`: ESLint пытается исправить все workspace-пакеты, даже если один из них завершился с ошибкой.

## Приложения

- `apps/shell` - host-приложение на Vue 3 + Vite. Отвечает за общий layout, глобальные состояния, авторизацию, уведомления, i18n и lazy import remote-модулей.
- `apps/map` - remote `World Map` на Svelte + MapLibre GL. Экспортирует карту через Module Federation и использует shared UI/SDK.
- `bff` - Bun backend-for-frontend вне `apps/*`; предназначен для импорта реальных world data и proxy/composition endpoints. Подробнее: [`docs/bff.md`](docs/bff.md).

Диаграмма `docs/FE.png` описывает весь целевой frontend, даже если часть модулей пока не создана физически:

- `Shell / Host` - Vue 3 + Vite host, глобальный state, auth, layout, notifications, i18n.
- `World Map` - Svelte + MapLibre GL remote, уже существует как `apps/map`.
- `Fleet & Ops` - Vue 3 remote для флота, расписаний, операций и рейсов.
- `Finance & Stock` - Vue remote для финансов, кредитов, транзакций, IPO, акций и торгов.
- `Network Planner` - Vue 3 remote для планирования маршрутной сети.
- `Events & News` - Vue 3 remote для событий, новостей, уведомлений и действий игрока.
- `HR & Facilities` - Vue 3 remote для персонала, объектов аэропорта и инфраструктуры.

Все remote-приложения подключаются к `Shell / Host` через Module Federation и должны загружаться lazy import'ами.

## Пакеты

- `packages/air-ui` - дизайн-система и UI-kit на Vue 3, Tailwind CSS и Storybook.
- `packages/game-sdk` - клиентский SDK для API: auth, fetch wrapper и будущие typed-контракты.
- `packages/eslint-config` - shared ESLint preset'ы для TypeScript, Vue и Svelte.
- `event-bus` - целевой shared package для cross-MFE pub/sub между shell и remotes.
- `api-contracts` - целевой shared package для OpenAPI -> TypeScript types и Zod-схем.

`event-bus` и `api-contracts` пока описаны схемой как целевые библиотеки; при реализации их нужно добавлять как отдельные workspace-пакеты и подключать через shared dependencies.

## Интеграции

- Backend REST API используется через `game-sdk` и будущий `api-contracts`.
- Backend Socket.IO используется shell и remotes для live events/notifications через общий `event-bus`.
- UI-компоненты, Tailwind CSS, icons и theme tokens приходят из `air-ui`.
- I18N-контракт RU/EN описан в [`docs/I18N.md`](docs/I18N.md): shell владеет текущей локалью, remotes получают `appLocale` и событие `i18n:locale-changed`.
- BFF-контракт описан в [`docs/bff.md`](docs/bff.md): `import` нормализует реальные данные мира, `proxy` добавляет frontend-specific фильтры поверх backend API.

## Доменная Модель

`docs/erd.txt` описывает основные сущности игры:

- Auth: `User`.
- World: `Country`, `Region`, `RegionLink`, `Airport`, `GlobalFuelPrice`.
- Airline: `Airline`, staff configs, airport contracts.
- Aircraft: manufacturers, types, aircraft, seats, modifiers, orders, leasing.
- Operations: routes, tariffs, schedules, flights and passenger load.
- Ground/Maintenance: facilities and maintenance records.
- Finance: loans, transactions, stock listings, shareholdings, trades.
- Events: event templates, actions, instances and notifications.
- Uploads: storage metadata for uploaded assets.

Фронтенд должен относиться к этим сущностям как к контрактам продукта: UI-компоненты не должны хардкодить backend-форматы, а приложения должны идти через `game-sdk` / `api-contracts`.
