# TODO5: Планирование маршрута

Источник: раздел 5 `TODO_MVP.md` - "Планирование маршрута".

Исходное допущение пользователя: разделы 1-4 уже реализованы. Значит у игрока уже есть аккаунт, авиакомпания, стартовая база, dashboard/map baseline и минимум один купленный самолет.

Backend не меняем. Так как backend route endpoints сейчас отсутствуют, MVP-модель маршрутов создаем в BFF. При этом максимально используем существующие backend/BFF данные: airline, aircrafts, aircraft-types, airports, regions, region-links, demand calculation.

## Цель раздела

Игрок должен найти перспективное направление из своей базы, понять спрос и ограничения, принять решение, создать маршрут и увидеть его в разделе маршрутов, Dashboard и карте.

MVP этого раздела заканчивается состоянием `route.awaiting_schedule`: маршрут создан и готов к назначению расписания в TODO6.

## Текущее состояние

- `apps/network-planner/src/RemoteApp.vue` уже показывает route opportunities через `GET /game/network-opportunities`.
- BFF `GET /demand/airport-pair` уже считает спрос и сохраняет его в `RegionLink.base_daily_demand_ab/ba`.
- BFF `GET /game/network-opportunities` уже ранжирует аэропорты по demand/score.
- Dashboard BFF сейчас отдает routes capability как `not_configured`, а items пустые.
- Map state умеет показывать базу и opportunities, но routes feature collection пустой.
- Backend не имеет route/flight endpoints, поэтому сохранить маршрут в backend нельзя.

## Продуктовый Definition of Done

- [ ] Игрок видит список направлений из своей базы.
- [ ] Для каждого направления видны спрос, дистанция, ориентировочная выручка, ограничения аэропортов и совместимость с текущим флотом.
- [ ] Расчет спроса превращается в понятную рекомендацию: стоит открывать маршрут или нет.
- [ ] Игрок может создать маршрут из выбранного направления.
- [ ] Созданный маршрут появляется в `/airports/routes`.
- [ ] Dashboard показывает количество маршрутов и следующий шаг.
- [ ] Карта показывает линию созданного маршрута.
- [ ] Маршрут имеет статус `awaiting_schedule` и ведет игрока к расписанию.

## BFF-owned route state

### 1. Хранилище MVP-маршрутов

- [ ] Добавить BFF module `bff/src/modules/routes`.

  Предлагаемые файлы:
  - `index.ts` - HTTP router;
  - `types.ts` - BFF-owned route contracts;
  - `storage.ts` - persistence;
  - `snapshot.ts` - загрузка backend/BFF данных;
  - `planning.ts` - расчеты спроса, дистанции, revenue, suitability;
  - `validation.ts` - проверки создания маршрута;
  - `errors.ts` - route-specific error codes.

- [ ] Добавить persistence в `bff/data/game-state/routes.json`.

  Минимальный формат:

  ```ts
  type StoredRoute = {
    id: string;
    airline_id: string;
    origin_airport_id: string;
    destination_airport_id: string;
    selected_aircraft_id?: string;
    selected_aircraft_type_id?: string;
    status: "draft" | "awaiting_schedule" | "scheduled" | "active" | "paused";
    base_frequency_per_week: number;
    demand_snapshot: {
      origin_daily_passengers: number;
      destination_daily_passengers: number;
      distance_km: number;
      region_link_id?: string;
      calculated_at: string;
    };
    economics_snapshot: {
      estimated_fare_per_passenger: number;
      estimated_revenue_per_flight: number;
      estimated_cost_per_flight: number;
      estimated_profit_per_flight: number;
      confidence: "low" | "medium" | "high";
    };
    constraints_snapshot: RouteConstraint[];
    created_at: string;
    updated_at: string;
  };
  ```

- [ ] Изоляция данных должна идти по `airline_id`.

  BFF всегда получает airline через backend `/airline/me`, затем читает/пишет только маршруты этой airline. Нельзя доверять `airline_id` из body клиента.

- [ ] Добавить простую file-lock/atomic write стратегию.

  Для MVP достаточно:
  - читать JSON при запросе;
  - писать во временный файл;
  - atomic rename;
  - при corrupt JSON возвращать BFF error и не терять файл.

- [ ] Подготовить future migration путь.

  В комментариях и docs указать, что BFF route storage является MVP overlay до появления backend route endpoints. Структура должна быть близка к будущим ERD сущностям `Route`, `RouteTariff`, `PlaneSchedule`.

### 2. BFF endpoints для маршрутов

- [ ] `GET /routes/opportunities`

  Query:
  - `origin_airport_id`;
  - `aircraft_id`;
  - `aircraft_type_id`;
  - `min_demand`;
  - `max_distance`;
  - `sort=recommended|demand|profit|distance|slots`;
  - `limit`.

  Ответ должен расширить текущий `/game/network-opportunities`:
  - origin airport;
  - destination airport;
  - region;
  - demand;
  - distance;
  - route score;
  - estimated economics;
  - compatible owned aircraft;
  - blocking reasons;
  - warnings;
  - existing route marker, если маршрут уже создан.

- [ ] `GET /routes/opportunities/:destinationAirportId/preview`

  Возвращает детальный preview перед созданием маршрута:
  - спрос туда/обратно;
  - дистанция;
  - подходящие самолеты игрока;
  - рекомендуемый самолет;
  - максимальная частота на текущем флоте;
  - ограничения аэропортов;
  - примерная выручка/расход/прибыль;
  - recommendation: `open | risky | blocked`.

- [ ] `POST /routes`

  Body:

  ```ts
  type CreateRouteRequest = {
    origin_airport_id: string;
    destination_airport_id: string;
    selected_aircraft_id?: string;
    selected_aircraft_type_id?: string;
    base_frequency_per_week?: number;
  };
  ```

  Правила:
  - origin/destination существуют;
  - origin != destination;
  - origin принадлежит стартовой базе или одному из будущих hubs игрока;
  - спрос может быть рассчитан через `/demand/airport-pair` logic;
  - хотя бы один купленный самолет совместим или маршрут создается как `draft` с явным warning `NO_COMPATIBLE_AIRCRAFT`;
  - нельзя создать дубль active/draft маршрута той же пары для той же airline без подтверждения.

- [ ] `GET /routes`

  Возвращает список маршрутов airline:
  - status;
  - airports;
  - demand;
  - assigned aircraft summary;
  - economics;
  - next action;
  - schedule summary, если TODO6 уже реализован.

- [ ] `GET /routes/:id`

  Возвращает детальную карточку route.

- [ ] `PATCH /routes/:id`

  Для MVP:
  - update `selected_aircraft_id`;
  - update `base_frequency_per_week`;
  - pause/resume route после TODO6;
  - refresh demand/economics snapshot.

- [ ] `DELETE /routes/:id`

  Для MVP можно удалить только `draft` / `awaiting_schedule` без выполненных рейсов. Если есть расписание/рейсы, возвращать `ROUTE_HAS_DEPENDENCIES`.

### 3. Расчеты в BFF

- [ ] Использовать существующий demand calculation.

  Не дублировать формулы без необходимости. Общую часть из `bff/src/modules/demand` можно вынести в shared helper или вызвать тот же internal function.

- [ ] Добавить расчет дистанции.

  Использовать coordinates из airport `geog`/`geom`, как уже делается в demand/game map. Если координат нет, вернуть warning `MISSING_COORDINATES` и fallback distance.

- [ ] Добавить расчет совместимости с флотом.

  Для каждого owned aircraft:
  - aircraft type range >= distance;
  - origin runway >= min runway;
  - destination runway >= min runway;
  - aircraft status not maintenance;
  - maintenance ratio above MVP threshold;
  - base airport matches origin or warning `AIRCRAFT_REPOSITION_REQUIRED`.

- [ ] Добавить rough economics.

  Минимальная формула:
  - fare per passenger = function(distance, demand, reputation, route class fallback);
  - expected load factor = clamp(demand / offered seats per day);
  - revenue per flight = seats * load factor * fare;
  - cost per flight = fuel cost + maintenance cost + airport fees + turnaround;
  - profit per flight = revenue - cost.

  Все значения должны быть помечены как MVP estimate, не как финальная бухгалтерия.

- [ ] Добавить recommendation engine.

  `open`:
  - есть совместимый самолет;
  - positive estimated profit;
  - enough demand for at least 3 flights/week.

  `risky`:
  - demand низкий;
  - profit около нуля;
  - reposition needed;
  - limited slots/night ops.

  `blocked`:
  - нет подходящего самолета;
  - runway incompatible;
  - distance exceeds all owned aircraft range;
  - no demand data.

## Frontend: Network Planner / Routes

### 1. Структура приложения

- [ ] Разделить `apps/network-planner/src/RemoteApp.vue` на feature modules.

  Предлагаемая структура:
  - `api.ts`;
  - `types.ts`;
  - `i18n/en.ts`, `i18n/ru.ts`, `i18n/index.ts`;
  - `components/OpportunityFilters.vue`;
  - `components/OpportunityCard.vue`;
  - `components/RoutePreviewPanel.vue`;
  - `components/RouteList.vue`;
  - `components/RouteDetail.vue`;
  - `components/RouteConstraintList.vue`.

- [ ] Добавить локализацию `ru/en` для network-planner.

  Сейчас строки в remote hardcoded на английском. Для MVP route planning это нужно исправить.

- [ ] Добавить режимы по shellPath.

  Использовать `shellPath`:
  - `/airports/hubs` - base/hub overview или redirect to routes if hubs not implemented;
  - `/airports/routes` - основной route planning/list;
  - `/airports/fees-slots` - может показывать airport constraints read-only;
  - `/airports/contracts` - disabled/empty for MVP.

### 2. Opportunities экран

- [ ] Показывать возможности из стартовой базы по умолчанию.

  Если игрок выбирает другой origin, объяснить, что это preview, пока hubs не реализованы.

- [ ] Добавить фильтры:
  - aircraft;
  - min demand;
  - max distance;
  - only compatible;
  - only profitable estimate;
  - sort.

- [ ] Opportunity card должна показывать:
  - destination IATA/ICAO/name/city;
  - region;
  - distance;
  - outbound/inbound demand;
  - estimated fare/revenue/cost/profit;
  - compatible aircraft count;
  - recommendation badge;
  - CTA `Preview route`.

- [ ] Empty states:
  - нет самолета -> CTA в `/fleet/overview`;
  - нет demand data -> CTA calculate demand;
  - нет подходящих направлений -> сбросить фильтры;
  - backend/BFF error -> retry.

### 3. Route preview

- [ ] Preview panel должен превращать спрос в решение.

  Секции:
  - Route pair;
  - Demand;
  - Aircraft fit;
  - Airport constraints;
  - Economics estimate;
  - Recommendation;
  - Create route CTA.

- [ ] Игрок может выбрать самолет или тип самолета.

  Для MVP лучше выбрать owned aircraft, потому что TODO6 назначает конкретный самолет на расписание. Если нет подходящего owned aircraft, разрешить `draft` с выбранным type и CTA "Купить подходящий самолет".

- [ ] Перед созданием маршрута показать последствия.

  Текст:
  - маршрут будет создан в статусе "Ожидает расписания";
  - следующий шаг - настроить расписание;
  - финальные деньги появятся после запуска рейсов.

### 4. Route list/detail

- [ ] `/airports/routes` должен показывать созданные маршруты.

  Минимум:
  - origin -> destination;
  - status;
  - selected aircraft;
  - frequency placeholder;
  - demand;
  - economics estimate;
  - next action: `Create schedule`.

- [ ] Детальная карточка маршрута.

  Должна показывать:
  - airports;
  - demand snapshot;
  - assigned aircraft;
  - restrictions;
  - schedule state;
  - financial estimate;
  - actions: refresh preview, edit draft, create schedule, delete draft.

- [ ] После создания маршрута UI обновляет:
  - route list;
  - Dashboard via `game:snapshot-invalidated`;
  - map via `map:network-refresh-requested`;
  - notification `route:created`.

## Интеграция с Dashboard и Map

- [ ] Обновить `GET /game/dashboard-summary`.

  Вместо `routes.capabilities = not_configured` вернуть:
  - active_routes;
  - awaiting_schedule;
  - draft_routes;
  - first route cards;
  - next_action = `CREATE_SCHEDULE`, если есть route awaiting schedule.

- [ ] Обновить `GET /game/map-state`.

  Добавить route GeoJSON features:
  - line from origin to destination;
  - properties: route id, status, demand, profit estimate;
  - selected route support via query `selected_route_id`.

- [ ] Event bus.

  Добавить/использовать события:
  - `route:created`;
  - `route:selected`;
  - `game:snapshot-invalidated`;
  - `map:network-refresh-requested`;
  - `navigation:intent` to `/operations/schedule`.

## I18N и тексты

- [ ] Все новые строки route planning добавить на `ru` и `en`.

  Категории:
  - filters;
  - route statuses;
  - recommendation statuses;
  - blocking reasons/warnings;
  - empty states;
  - CTA;
  - economics labels.

- [ ] Не показывать пользователю backend/internal terms.

  Запрещено в UI:
  - `region_link_id`;
  - raw `airport_id`;
  - raw status без локализации;
  - raw BFF error.

## Тесты

### BFF tests

- [ ] route storage read/write by airline id.
- [ ] opportunity preview with compatible aircraft.
- [ ] preview blocked by runway.
- [ ] preview blocked by range.
- [ ] create route success.
- [ ] prevent duplicate route.
- [ ] list routes only for current airline.
- [ ] dashboard summary includes route counts.
- [ ] map state includes route line feature.

### Frontend tests

- [ ] opportunities render from BFF response.
- [ ] filters update query.
- [ ] preview panel shows recommendation.
- [ ] create route success updates list and emits events.
- [ ] no aircraft empty state links to fleet.
- [ ] route awaiting schedule CTA links to `/operations/schedule`.

### Manual QA

- [ ] Игрок с купленным самолетом открывает `/airports/routes`.
- [ ] Выбирает направление, видит спрос и economics.
- [ ] Создает маршрут.
- [ ] Видит маршрут в списке.
- [ ] Dashboard показывает route awaiting schedule.
- [ ] Карта показывает линию маршрута.

## Документация

- [ ] Обновить `docs/bff.md`: добавить BFF-owned route overlay и endpoints.
- [ ] Обновить `docs/bff-openapi.json` generation overlay для `/routes/*`.
- [ ] Обновить `AGENTS.md`, если route overlay становится архитектурным правилом.
- [ ] Добавить short note в будущую базу знаний: "Как открыть первый маршрут".

## Порядок реализации

1. Добавить route storage и BFF route contracts.
2. Реализовать route opportunities/preview в BFF.
3. Реализовать create/list/detail routes в BFF.
4. Подключить route data к dashboard/map state.
5. Разбить network-planner на api/types/components/i18n.
6. Реализовать opportunity list и preview.
7. Реализовать route list/detail.
8. Добавить события и навигацию к schedule.
9. Добавить тесты BFF и frontend.
10. Обновить docs и BFF OpenAPI.

## Definition of Done для TODO5

- [ ] Route planning работает только через BFF.
- [ ] Маршруты сохраняются в BFF-owned state с изоляцией по airline.
- [ ] Игрок может выбрать направление и увидеть recommendation.
- [ ] Игрок может создать route.
- [ ] Route появляется в UI, Dashboard и Map.
- [ ] Route ведет к следующему шагу: расписанию.
- [ ] Все тексты локализованы на `ru` и `en`.
- [ ] Есть BFF/frontend тесты.
