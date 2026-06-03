# TODO2_3: Dashboard, общий статус компании и карта мира

Источник: разделы `TODO_MVP.md`:

- `2. Dashboard и общий статус компании`
- `3. Карта мира`

План по первому разделу считаем выполненным. Значит этот план строится поверх BFF-first API, централизованных retry в BFF, корректного onboarding/session flow и выбора стартовой базы без raw backend id.

Backend не меняем. Все недостающие агрегаты, read models, frontend-friendly ответы, пустые состояния и временные композиции делаем в `frontend/bff`, максимально используя уже существующие backend endpoints.

## Цель

Сделать первый экран после создания авиакомпании полезным игровым центром:

- игрок сразу видит реальное состояние компании;
- статичные topbar-метрики заменены данными игрока;
- Dashboard предлагает следующий лучший шаг;
- основные разделы навигации показывают прогресс и пустые состояния;
- карта показывает игровые объекты: стартовую базу, важные аэропорты, выбранные направления и активные маршруты, когда они появятся;
- карта остается вспомогательным инструментом, а не единственным способом управления.

## Текущее состояние

- `/dashboard` сейчас маппится на remote `map` через `apps/shell/src/mfe-routing.ts`.
- `ShellRemoteView` для `activeRemoteId === "map"` монтирует Svelte-карту и поверх нее показывает `MapControls`.
- `apps/map` умеет:
  - инициализировать MapLibre;
  - менять light/dark style;
  - переключать globe/mercator;
  - zoom in/out;
  - добавлять 3D layer для aircraft models, но нет публичного сценария данных для игровых объектов.
- `apps/shell/src/navigation.ts` содержит `getStatusMetrics`, но сейчас там статичные значения `$50,000,000`, `30,000 t`, `122`.
- `bff/src/modules/game/index.ts` уже собирает:
  - `GET /game/finance-overview`;
  - `GET /game/facilities-overview`;
  - `GET /game/events-feed`;
  - `GET /game/network-opportunities`.
- В BFF уже есть `loadGameSnapshot`, который читает airline, aircrafts, aircraft types, airports, regions, region-links.
- Полноценных backend endpoints для routes/flights сейчас нет. Для этих пунктов BFF должен возвращать честные нулевые/пустые состояния и заранее определить контракт, который будет заполнен в следующих MVP-разделах.

## Главные продуктовые требования

- Dashboard показывает реальные данные текущей авиакомпании: баланс, название, стартовая база, флот, маршруты, рейсы, предупреждения.
- Dashboard не выглядит пустой картой после onboarding.
- Dashboard объясняет следующий шаг:
  - нет самолетов -> купить первый самолет;
  - есть самолет, но нет маршрутов -> выбрать направление;
  - есть маршрут, но нет расписания -> создать расписание;
  - есть рейсы -> смотреть операции/финансы.
- Навигация показывает, какие разделы уже полезны, какие пока пустые, и почему.
- Карта показывает стартовую базу и важные аэропорты уже сейчас.
- Активные маршруты показываются линиями, как только появится route state из BFF.
- На mobile все критичные действия доступны без карты: через карточки, списки и CTA.

## Архитектурные правила

- [ ] Все данные Dashboard и карты загружаются только из BFF.

  Shell и map remote не должны напрямую ходить в backend или собирать dashboard state через несколько независимых backend-like запросов. Для первого экрана нужен один основной BFF read model.

- [ ] Dashboard read model должен быть frontend-facing, а не копией backend DTO.

  UI не должен знать про сырые `region_link`, `base_daily_demand_ab`, внутренние admin-only справочники и backend-only naming. BFF должен вернуть понятные агрегаты.

- [ ] Карта получает готовый map-state, а не сама вычисляет бизнес-смысл.

  Svelte map remote должен отвечать за визуализацию GeoJSON/слоев/выбора, а не за вычисление следующего шага, риска банкротства или ранжирования аэропортов.

- [ ] BFF должен возвращать честные пустые состояния для routes/flights.

  Так как backend endpoints routes/flights пока отсутствуют, нельзя имитировать полноценную готовность. Нужно вернуть `routes.count = 0`, `flights.upcoming_count = 0`, `capabilities.routes = "not_configured"` или аналогичный флаг и использовать его в UI.

- [ ] Контракты для routes/flights должны быть готовы к следующему MVP-блоку.

  Следующий раздел будет создавать первый маршрут. Поэтому Dashboard и Map уже должны принимать `routes`, `selectedDirections`, `flights` массивами, даже если сейчас они пустые.

## BFF-план

### 1. Dashboard summary endpoint

- [ ] Добавить `GET /game/dashboard-summary`.

  Endpoint должен требовать пользовательский `Authorization` token, проверять его через общий auth helper и использовать централизованный BFF retry.

- [ ] Использовать существующий `loadGameSnapshot`.

  Источники:
  - user token -> `GET /airline/me`;
  - user token -> `GET /aircrafts`;
  - admin/service token, пока backend не открыл read-only -> `GET /aircraft-types`, `GET /airports`, `GET /regions`, `GET /region-links`.

- [ ] Вернуть `airline` summary.

  Минимум:

  ```ts
  type DashboardAirlineSummary = {
    id?: string;
    name: string;
    balance: number;
    credit_rating: number;
    reputation: number;
    safety_rating: number;
    is_bankrupt: boolean;
  };
  ```

- [ ] Вернуть `base` summary.

  Минимум:

  ```ts
  type DashboardBaseSummary = {
    airport?: {
      id: string;
      label: string;
      iata_code?: string;
      icao_code?: string;
      intl_name?: string;
      local_name?: string;
      municipality?: string;
      max_runway_length_m?: number;
      max_runway_uses_per_day?: number;
      works_at_night?: boolean;
      gate_fee?: number;
      stand_fee?: number;
      turnaround_point_price?: number;
      coordinates?: { latitude: number; longitude: number };
    };
    status: "missing" | "ready";
    warnings: string[];
  };
  ```

- [ ] Вернуть `fleet` summary.

  Минимум:

  ```ts
  type DashboardFleetSummary = {
    total_aircraft: number;
    ready_aircraft: number;
    maintenance_aircraft: number;
    in_flight_aircraft: number;
    fleet_value: number;
    average_maintenance_ratio: number;
    compatible_base_types: number;
  };
  ```

- [ ] Вернуть `routes` summary.

  Пока backend routes отсутствуют:

  ```ts
  type DashboardRoutesSummary = {
    active_routes: number;
    draft_routes: number;
    awaiting_schedule: number;
    capabilities: "not_configured" | "available";
    items: DashboardRouteSummary[];
  };
  ```

  Для MVP текущего блока `items` может быть пустым. В следующем блоке BFF route store или backend route endpoints начнут его заполнять.

- [ ] Вернуть `flights` summary.

  Пока backend flights отсутствуют:

  ```ts
  type DashboardFlightsSummary = {
    live_flights: number;
    upcoming_flights: number;
    completed_today: number;
    capabilities: "not_configured" | "available";
    items: DashboardFlightSummary[];
  };
  ```

- [ ] Вернуть `alerts`.

  Использовать текущую логику `buildEventsFeed`, но для Dashboard вернуть компактный список:
  - cash warning;
  - no aircraft;
  - maintenance warning;
  - base warning;
  - no routes;
  - no schedule.

  Каждый alert должен иметь:
  - `code`;
  - `severity`;
  - `title_key` или frontend-localizable code;
  - `target_path`;
  - `action_code`.

- [ ] Вернуть `next_action`.

  Минимальная логика:
  - if no airline/base -> `/onboarding/airline`;
  - if no aircraft -> `/fleet/overview`, action `BUY_FIRST_AIRCRAFT`;
  - if aircraft exists and no routes -> `/airports/routes`, action `PLAN_FIRST_ROUTE`;
  - if route exists and no schedule -> `/operations/schedule`, action `CREATE_SCHEDULE`;
  - if flights exist -> `/operations/live-flights`, action `VIEW_OPERATIONS`;
  - if low balance -> secondary action `/finances/overview`.

- [ ] Вернуть `navigation_progress`.

  Для каждого основного раздела:
  - `path`;
  - `state`: `ready | empty | blocked | future`;
  - `reason_code`;
  - `count`;
  - `next_path`.

  Примеры:
  - Fleet: `empty` если `total_aircraft = 0`;
  - Airports/Routes: `blocked` если нет aircraft;
  - Operations/Schedule: `blocked` если нет route;
  - Finances: `ready` всегда после airline;
  - Staff: `ready` как обзор базы, но не критичный;
  - Admin: скрывать или `blocked` для обычного пользователя, если нет admin role.

- [ ] Добавить BFF тесты для `GET /game/dashboard-summary`.

  Кейсы:
  - no aircraft -> next action buy first aircraft;
  - aircraft exists, no routes -> plan first route;
  - low balance -> warning;
  - missing base airport -> base warning;
  - backend unavailable -> normalized retryable error;
  - invalid token -> `401`.

### 2. Map state endpoint

- [ ] Добавить `GET /game/map-state`.

  Endpoint должен отдавать весь state, нужный карте для первого экрана, без дополнительных backend-запросов из map remote.

- [ ] Поддержать query parameters.

  Минимум:
  - `scope=dashboard|network|operations`;
  - `selected_airport_id=<id>`;
  - `selected_route_id=<id>`;
  - `include_opportunities=true|false`.

- [ ] Вернуть стартовую базу как GeoJSON point.

  Использовать `geog` или `geom` из Airport, если поле доступно. Если координат нет, вернуть airport без geometry и warning `MISSING_COORDINATES`.

- [ ] Вернуть важные аэропорты.

  Для `scope=dashboard`:
  - стартовая база;
  - airports из top route opportunities;
  - airports, где базируются owned aircraft;
  - route endpoints, когда появятся routes.

- [ ] Вернуть top opportunities для карты.

  Можно использовать существующую логику `buildNetworkOpportunities`, но в map-state вернуть компактно:
  - destination airport point;
  - demand;
  - score;
  - distance, если есть;
  - relation to base.

- [ ] Вернуть route lines.

  Сейчас routes отсутствуют, но контракт должен быть:

  ```ts
  type MapRouteFeature = {
    id: string;
    status: "active" | "draft" | "scheduled" | "paused";
    origin_airport_id: string;
    destination_airport_id: string;
    demand?: number;
    flights_today?: number;
    geometry: GeoJSON.LineString;
  };
  ```

  До реализации route store возвращать `features: []` и `capabilities.routes = "not_configured"`.

- [ ] Вернуть selected entity.

  Если передан `selected_airport_id`, BFF должен вернуть detail card:
  - airport name;
  - IATA/ICAO;
  - region;
  - runway;
  - slots;
  - night ops;
  - fees;
  - demand/potential from base;
  - CTA target path.

- [ ] Добавить BFF tests для `GET /game/map-state`.

  Кейсы:
  - base airport with coordinates -> GeoJSON point;
  - airport without coordinates -> warning;
  - opportunities included;
  - selected airport detail;
  - no route backend -> empty route lines with explicit capability.

### 3. Shared game snapshot utilities

- [ ] Извлечь общие функции из `bff/src/modules/game/index.ts`.

  Сейчас `buildFinanceOverview`, `buildFacilitiesOverview`, `buildNetworkOpportunities` и будущие dashboard/map будут расти в одном файле. Нужно разнести:
  - `snapshot.ts` - loadGameSnapshot/types;
  - `finance.ts`;
  - `facilities.ts`;
  - `events.ts`;
  - `network.ts`;
  - `dashboard.ts`;
  - `map-state.ts`;
  - `geo.ts` - parsing POINT/geog/geom and LineString helpers.

- [ ] Не ломать существующие endpoints.

  `finance-stock`, `events-news`, `network-planner`, `hr-facilities` уже используют текущие `/game/*` endpoints. Рефактор должен быть внутренним.

## Shell Dashboard plan

### 1. Определить место Dashboard UI

- [ ] Решить, где живет dashboard.

  Рекомендуемый вариант для MVP:
  - оставить map remote как фон/центральную карту для `/dashboard`;
  - добавить dashboard overlay/layout в shell вокруг `SvelteWrapper`;
  - не превращать map remote в бизнес-dashboard.

  Причина: Dashboard владеет навигацией, CTA, i18n shell-текстами и общим состоянием, а map remote должен быть визуальным виджетом.

- [ ] Создать shell-компоненты:
  - `apps/shell/src/dashboard/DashboardView.vue` или `DashboardOverlay.vue`;
  - `DashboardMetricStrip.vue`;
  - `DashboardNextAction.vue`;
  - `DashboardAlerts.vue`;
  - `DashboardProgressNav.vue`;
  - `DashboardMapPanel.vue` если нужен контейнер/разметка для карты.

- [ ] Обновить `/dashboard` rendering.

  Варианты:
  - заменить `remoteId: "map"` на отдельный shell route `DashboardView`, который сам монтирует map remote;
  - или оставить `ShellRemoteView`, но для `path === "/dashboard"` рендерить dashboard overlay поверх карты.

  Предпочтительно первое: dashboard как shell-owned route, а map как embedded remote widget. Это уменьшит смешение "Dashboard = map".

### 2. Загрузка dashboard summary

- [ ] Добавить shell API helper.

  Например `apps/shell/src/dashboard/api.ts`:
  - `getDashboardSummary()`;
  - `getDashboardMapState()`;
  - typed response interfaces.

- [ ] Добавить state/composable.

  Например `useDashboardSummary`:
  - `data`;
  - `isLoading`;
  - `errorCode`;
  - `refresh`;
  - `lastLoadedAt`.

- [ ] Добавить refresh behavior.

  Минимум:
  - загрузка при открытии `/dashboard`;
  - ручной refresh;
  - обновление после событий `auth:session-restored`, `navigation:changed` для `/dashboard`, будущих `aircraft:purchased`, `route:created`.

- [ ] Не делать polling агрессивным.

  Для MVP можно без polling или с мягким refresh при возвращении на экран. Live обновления рейсов появятся позже.

### 3. Реальные topbar metrics

- [ ] Заменить статичный `getStatusMetrics`.

  Сейчас `getStatusMetrics` возвращает hardcoded account/fuel/planes. Нужно:
  - хранить global shell status summary после загрузки Dashboard или отдельного `/game/status-summary`;
  - показывать реальные balance и aircraft count;
  - fuel либо убрать/заменить на другой доступный показатель, если реального fuel state нет.

- [ ] Определить минимальные topbar метрики.

  Предлагаемо:
  - Balance;
  - Aircraft;
  - Alerts.

  Топливо не показывать, пока нет реального источника. Если оставлять fuel как будущую механику, показывать `-` и не делать вид, что это реальные данные.

- [ ] Добавить loading/unknown state.

  Пока dashboard summary не загружен:
  - skeleton or `-`;
  - не показывать fake values.

### 4. Dashboard content

- [ ] Header.

  Должен показывать:
  - airline name;
  - base airport label;
  - короткий статус компании;
  - last updated.

- [ ] Metric cards.

  Минимум:
  - Balance;
  - Aircraft owned;
  - Active routes;
  - Upcoming/live flights;
  - Alerts.

  Для routes/flights пока показывать `0` с пояснением, что они появятся после создания маршрута/расписания.

- [ ] Next action panel.

  Большой CTA:
  - label по `next_action.code`;
  - description;
  - target path;
  - secondary action, если есть.

  Примеры:
  - `BUY_FIRST_AIRCRAFT`: "Купить первый самолет";
  - `PLAN_FIRST_ROUTE`: "Выбрать первое направление";
  - `CREATE_SCHEDULE`: "Создать расписание";
  - `VIEW_OPERATIONS`: "Смотреть рейсы".

- [ ] Alerts panel.

  Показывать не только счетчик, но и 3-5 приоритетных предупреждений:
  - low balance;
  - no aircraft;
  - no routes;
  - missing base data;
  - maintenance.

  У каждого alert должен быть action target.

- [ ] Base card.

  Стартовая база:
  - IATA/ICAO;
  - город/название;
  - runway;
  - slots;
  - night ops;
  - fees;
  - CTA к Facilities или Network Planner.

- [ ] Fleet snapshot.

  Минимум:
  - total aircraft;
  - ready/maintenance/in flight;
  - if zero, empty state and CTA to Fleet.

- [ ] Routes/flights snapshot.

  Пока route/flight backend отсутствует:
  - clear empty state;
  - CTA to plan route only if aircraft exists;
  - do not show fake active routes/flights.

### 5. Navigation progress

- [ ] Добавить visual state в sidebar или dashboard progress panel.

  Основная навигация должна отражать прогресс:
  - Fleet empty until first aircraft;
  - Routes blocked until aircraft;
  - Operations blocked until route/schedule;
  - Finances ready;
  - Facilities ready;
  - Admin hidden/disabled for non-admin.

- [ ] Не перегружать sidebar.

  В sidebar достаточно badge/dot/disabled explanation. Подробное "что делать" лучше в Dashboard progress panel.

- [ ] Добавить route guards только там, где это не ломает обучение.

  Не обязательно запрещать переход в пустые разделы. Лучше показывать продуктовые empty states. Блокировать только то, что реально не может работать без prerequisites.

## Map remote plan

### 1. Контракт props для карты

- [ ] Расширить `createMap` props.

  Сейчас map получает `appLocale`, `controls`, `remoteId`, `rotation`, `shellPath`, `theme`. Добавить:
  - `mapState`;
  - `selectedAirportId`;
  - `selectedRouteId`;
  - `mode: "dashboard" | "network" | "operations"`;
  - callbacks/events через event-bus, а не function props, если нужно пересекать MFE boundaries.

- [ ] Добавить typed exports из `apps/map/src/moduleFederationComponents.svelte.ts`.

  Map state types должны быть доступны shell:
  - `MapAirportFeature`;
  - `MapRouteFeature`;
  - `MapState`;
  - `MapSelection`.

  Если типы нельзя импортировать удобно из remote, продублировать shared contract в `packages/api-contracts` или `packages/game-sdk`.

### 2. Слои карты

- [ ] Добавить source/layer для аэропортов.

  MapLibre layers:
  - base airport marker;
  - important airport markers;
  - opportunity markers;
  - selected airport highlight.

- [ ] Добавить source/layer для маршрутов.

  Даже если `features = []`, код слоя должен быть готов:
  - active routes solid line;
  - draft/selected directions dashed line;
  - selected route thicker/highlighted.

- [ ] Добавить слой labels или popup strategy.

  Для MVP достаточно side panel в shell или lightweight map popup:
  - IATA/ICAO;
  - airport label;
  - demand/score;
  - runway/slots.

- [ ] Обновлять слои при изменении theme/style.

  Сейчас при смене style карта вызывает `setStyle`, после чего custom sources/layers нужно восстановить на `style.load`. MapManager должен хранить текущий `mapState` и заново применять sources/layers после style reload.

- [ ] Fit bounds.

  При загрузке dashboard map:
  - если есть base + opportunities/routes, fit bounds по ним;
  - если есть только base, center on base;
  - если нет координат, fallback на world view.

### 3. Выбор аэропорта и маршрута

- [ ] Добавить click handling на airport layer.

  При клике:
  - set selected airport in map manager;
  - emit event-bus событие, например `map:airport-selected`;
  - shell показывает detail panel или обновляет selected state.

- [ ] Добавить click handling на route layer.

  При клике:
  - set selected route;
  - emit `map:route-selected`;
  - shell может перейти к route details, когда они появятся.

- [ ] Расширить `packages/event-bus` contracts.

  Добавить события:
  - `map:airport-selected`;
  - `map:route-selected`;
  - `map:viewport-changed` если нужно;
  - возможно `dashboard:next-action-clicked` для аналитики позже.

  Для каждого события добавить validators.

- [ ] Сохранить существующий `flight:selected`.

  Не ломать текущий контракт, но будущие live flights смогут использовать его.

### 4. Карта не должна блокировать MVP

- [ ] На Dashboard рядом с картой/поверх карты должен быть list fallback.

  Если карта не загрузилась, игрок все равно видит:
  - summary;
  - next action;
  - base card;
  - route opportunities list.

- [ ] На mobile не заставлять пользователя работать с картой.

  Рекомендуемый layout:
  - сверху summary/CTA;
  - карта ниже как collapse/section;
  - список важных аэропортов и действий доступен отдельно.

- [ ] Error state карты.

  Если MapLibre style не загрузился или remote failed:
  - показать non-blocking card;
  - оставить Dashboard usable;
  - предложить retry.

## Shell ↔ Map integration

- [ ] Shell загружает `dashboard-summary` и `map-state` параллельно.

  Dashboard summary не должен ждать полной карты. Карта может догружаться отдельно.

- [ ] Shell передает map-state в map remote.

  Не делать map remote владельцем API-запросов для dashboard режима. Это упростит auth, retries и SSR/diagnostics.

- [ ] Shell слушает map selection events.

  При выборе airport:
  - открыть detail panel;
  - подсветить selected item в списке;
  - показать CTA "Планировать маршрут" или "Смотреть базу".

- [ ] Shell отправляет navigation intents из CTA.

  CTA должны вести через router/event-bus:
  - buy aircraft -> `/fleet/overview`;
  - plan route -> `/airports/routes`;
  - schedule -> `/operations/schedule`;
  - finances -> `/finances/overview`.

## UI и layout

- [ ] Desktop layout.

  Рекомендуемый первый экран:
  - top header summary;
  - main area with map;
  - left or bottom overlay with next action + metrics;
  - right/side detail panel for selected airport/alert;
  - no card-inside-card.

- [ ] Tablet layout.

  - summary and next action above;
  - map full width with controls;
  - panels stack below;
  - sidebar collapsed state не должен вызывать overflow.

- [ ] Mobile layout.

  - CTA and metrics first;
  - base/fleet/routes cards;
  - map as optional section;
  - all actions reachable without map click.

- [ ] Loading states.

  - Dashboard skeleton for metrics/cards;
  - map loading overlay only over map area;
  - topbar metrics show `-` or skeleton, not fake values.

- [ ] Empty states.

  Required:
  - no aircraft;
  - no route;
  - no schedule;
  - no map coordinates;
  - no opportunities;
  - BFF unavailable.

- [ ] Error states.

  Must include:
  - human message;
  - retry button;
  - if auth expired, redirect through existing auth flow;
  - no raw backend/BFF stack traces.

## I18N

- [ ] Add shell dictionary keys for Dashboard.

  `en`/`ru` keys for:
  - dashboard title;
  - metrics labels;
  - next action labels/descriptions;
  - alert titles/descriptions;
  - base card labels;
  - empty states;
  - loading/error/retry.

- [ ] Add map dictionary keys.

  Если map remote показывает visible text, строки должны быть в его feature dictionary or shell-provided labels. Нельзя оставлять hardcoded English в popups/details.

- [ ] Format values consistently.

  - money: same currency format as finance;
  - aircraft count;
  - routes/flights counts;
  - runway meters;
  - slots/day;
  - demand pax/day.

## API contracts and types

- [ ] Обновить BFF OpenAPI generation.

  Добавить overlay schemas/paths for:
  - `/game/dashboard-summary`;
  - `/game/map-state`.

- [ ] Regenerate `docs/bff-openapi.json`.

  После реализации выполнить:

  ```bash
  bun run generate:bff-openapi
  bun run generate:openapi
  ```

- [ ] Использовать generated types там, где это не замедляет разработку.

  Если BFF OpenAPI generation already feeds `packages/api-contracts`, использовать типы из `@airlinesim/api-contracts` для shell/map API responses.

## Tests

### BFF tests

- [ ] `dashboard-summary` with no aircraft.

  Ожидание:
  - `fleet.total_aircraft = 0`;
  - `next_action.code = BUY_FIRST_AIRCRAFT`;
  - route/flight capabilities explicit.

- [ ] `dashboard-summary` with aircraft and no routes.

  Ожидание:
  - next action `PLAN_FIRST_ROUTE`;
  - Fleet ready;
  - Routes empty/ready-to-plan.

- [ ] `dashboard-summary` low balance.

  Ожидание:
  - warning severity `danger` or `warning`;
  - finance target path.

- [ ] `map-state` base airport geometry.

  Ожидание:
  - valid GeoJSON Point;
  - airport properties contain labels and metrics.

- [ ] `map-state` missing coordinates.

  Ожидание:
  - warning;
  - no crash;
  - fallback world view metadata.

- [ ] `map-state` opportunities.

  Ожидание:
  - opportunity airport features;
  - score/demand props;
  - no duplicate base airport marker.

- [ ] `map-state` no routes backend.

  Ожидание:
  - empty route features;
  - capabilities routes not configured.

### Shell tests

- [ ] Dashboard loads summary and renders metrics.
- [ ] Dashboard renders next action for no-aircraft state.
- [ ] Dashboard CTA navigates to correct route.
- [ ] Topbar metrics use real summary and no hardcoded values.
- [ ] Dashboard handles loading/error/empty states.
- [ ] Navigation progress renders blocked/empty/ready sections.
- [ ] Mobile layout smoke test if existing tooling supports it.

### Map tests

- [ ] MapManager applies airport source/layers when map is ready.
- [ ] MapManager reapplies game layers after style change.
- [ ] MapManager fit bounds for base + opportunities.
- [ ] Airport click emits typed event.
- [ ] Route click emits typed event.
- [ ] Empty map-state does not crash.

### Manual QA

- [ ] New airline with no aircraft opens Dashboard and sees "buy first aircraft".
- [ ] Dashboard shows real airline name, balance, base and zero aircraft.
- [ ] Topbar does not show fake `$50,000,000`, `30,000 t`, `122`.
- [ ] Base airport appears on map if coordinates exist.
- [ ] Important opportunities appear on map/list when available.
- [ ] Map failure does not block CTA or dashboard information.
- [ ] Mobile dashboard has no horizontal overflow and CTA is visible before map.

## Документация

- [ ] Обновить `docs/bff.md`.

  Добавить:
  - `/game/dashboard-summary`;
  - `/game/map-state`;
  - что routes/flights пока возвращаются как empty capabilities до соответствующего MVP-блока;
  - что map remote не ходит в backend напрямую.

- [ ] Обновить `docs/mfe-routing.md`.

  Если `/dashboard` станет shell-owned route with embedded map remote, это нужно описать как исключение из обычного remote route flow.

- [ ] Обновить `frontend/AGENTS.md`, если меняется правило Dashboard ownership.

  Например: "Dashboard принадлежит shell, map remote используется как визуальный виджет".

- [ ] Добавить краткую документацию по map-state contract.

  Можно отдельным файлом `docs/map-state.md`, если контракт получается объемным. Описать:
  - source of truth;
  - GeoJSON structure;
  - selection events;
  - behavior without routes/flights backend.

## Порядок реализации

1. Вынести shared game snapshot utilities в BFF без изменения поведения старых endpoints.
2. Добавить `GET /game/dashboard-summary` и BFF tests.
3. Добавить `GET /game/map-state` и BFF tests.
4. Обновить BFF OpenAPI overlay и сгенерировать contracts.
5. Создать shell dashboard route/component и перевести `/dashboard` из "просто карта" в shell-owned dashboard.
6. Реализовать dashboard summary cards, next action, alerts, base/fleet/routes/flights sections.
7. Заменить hardcoded topbar metrics на реальные summary metrics.
8. Реализовать navigation progress states.
9. Расширить map remote props/types под map-state.
10. Добавить airport and route GeoJSON layers in MapManager.
11. Добавить selection events in `event-bus`.
12. Связать Shell detail panel/list with map selection.
13. Добавить responsive states and non-map fallback.
14. Добавить i18n `ru`/`en`.
15. Обновить docs.
16. Запустить проверки:
    - `bun --cwd bff run test`;
    - `bun --cwd apps/shell run test`;
    - `bun --cwd apps/map run test`;
    - `bun run lint`.

## Definition of Done для TODO2_3

- [ ] `/dashboard` показывает реальное состояние авиакомпании, а не только карту.
- [ ] Dashboard summary загружается из BFF одним frontend-facing read model.
- [ ] Balance, airline name, base, fleet count, route count, flight count and alerts отображаются из реальных данных или честных empty capabilities.
- [ ] Dashboard показывает следующий лучший шаг и CTA ведет в правильный раздел.
- [ ] Topbar/sidebar больше не показывают hardcoded/fake operational metrics.
- [ ] Навигация или dashboard progress объясняет, какие разделы ready/empty/blocked.
- [ ] Map state загружается из BFF.
- [ ] Карта показывает стартовую базу и важные аэропорты, если есть координаты.
- [ ] Карта умеет принимать route line features, даже если сейчас они пустые.
- [ ] Выбор аэропорта на карте открывает понятную detail/action area.
- [ ] Все критичные действия доступны без использования карты.
- [ ] Loading, empty and error states готовы для Dashboard и карты.
- [ ] Все новые тексты добавлены на `ru` и `en`.
- [ ] Добавлены BFF, shell and map tests.
- [ ] Обновлена документация по Dashboard ownership and map-state contract.
