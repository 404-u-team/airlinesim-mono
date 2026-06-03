# TODO6: Расписание и запуск рейсов

Источник: раздел 6 `TODO_MVP.md` - "Расписание и запуск рейсов".

Исходное допущение пользователя: разделы 1-5 уже реализованы. Значит у игрока есть авиакомпания, база, самолет, созданный route в BFF-owned state и route status `awaiting_schedule`.

Backend не меняем. Так как backend schedule/flight endpoints отсутствуют, MVP-расписания и рейсы реализуем как BFF-owned overlay поверх существующих backend/BFF данных: airline, aircrafts, aircraft-types, airports, routes, demand, finance estimates.

## Цель раздела

Игрок должен назначить самолет на созданный маршрут, выбрать простое расписание, пройти проверку ограничений, активировать расписание и увидеть ближайшие/первые рейсы.

MVP этого раздела заканчивается состоянием, когда route имеет активное расписание, а BFF сгенерировал upcoming/live/completed flight instances, которые видны в Operations и Dashboard.

## Продуктовый Definition of Done

- [ ] Игрок выбирает route awaiting schedule.
- [ ] Игрок выбирает конкретный купленный самолет.
- [ ] Игрок выбирает простую частоту: ежедневно, 3 раза в неделю, 1 раз в неделю или custom days.
- [ ] Игрок выбирает время вылета.
- [ ] UI показывает проверку ограничений до активации.
- [ ] Игрок активирует расписание.
- [ ] Route переходит в `scheduled` или `active`.
- [ ] Появляется список ближайших рейсов.
- [ ] Dashboard показывает upcoming/live flights.
- [ ] Если расписание невозможно, UI объясняет причину и дает действие.

## BFF-owned schedule/flight state

### 1. Хранилище расписаний

- [ ] Добавить BFF module `bff/src/modules/operations`.

  Предлагаемые файлы:
  - `index.ts` - HTTP router;
  - `types.ts` - schedules/flights contracts;
  - `storage.ts` - persistence;
  - `snapshot.ts` - загрузка airline/routes/fleet/airports;
  - `schedule-validation.ts` - проверки ограничений;
  - `flight-generation.ts` - материализация рейсов;
  - `economics.ts` - expected flight economics;
  - `time.ts` - date/time helpers;
  - `errors.ts` - operation error codes.

- [ ] Добавить persistence в `bff/data/game-state/schedules.json`.

  Минимальный schedule:

  ```ts
  type StoredSchedule = {
    id: string;
    airline_id: string;
    route_id: string;
    aircraft_id: string;
    status: "draft" | "active" | "paused";
    pattern: {
      mode: "daily" | "weekly";
      days_of_week: number[];
      departure_local_time: string;
      timezone?: string;
      turnaround_minutes: number;
    };
    validity: {
      starts_on: string;
      ends_on?: string;
    };
    checks_snapshot: ScheduleCheck[];
    created_at: string;
    updated_at: string;
  };
  ```

- [ ] Добавить persistence в `bff/data/game-state/flights.json`.

  Минимальный flight:

  ```ts
  type StoredFlight = {
    id: string;
    airline_id: string;
    route_id: string;
    schedule_id: string;
    aircraft_id: string;
    origin_airport_id: string;
    destination_airport_id: string;
    status: "scheduled" | "boarding" | "in_flight" | "completed" | "cancelled";
    departure_at: string;
    arrival_at: string;
    expected: {
      passengers: number;
      load_factor: number;
      revenue: number;
      cost: number;
      profit: number;
    };
    actual?: {
      passengers: number;
      load_factor: number;
      revenue: number;
      cost: number;
      profit: number;
    };
    created_at: string;
    updated_at: string;
  };
  ```

- [ ] Использовать airline_id как boundary.

  Все schedules/flights читаются и пишутся только для текущей backend airline. Клиент не передает trusted airline id.

- [ ] Поддержать deterministic MVP flight generation.

  Рейсы генерируются на ближайшие 7-14 дней при активации schedule и/или при `GET /operations/flights`. Не нужна real-time симуляция, но статусы должны обновляться на основе текущего времени:
  - до departure: `scheduled`;
  - departure window: `boarding` или `in_flight`;
  - after arrival: `completed`.

### 2. BFF endpoints

- [ ] `GET /operations/schedule-options?route_id=<id>`

  Возвращает данные для формы:
  - route;
  - compatible aircraft;
  - default patterns;
  - recommended frequency;
  - airport constraints;
  - estimated duration;
  - estimated economics per flight/week.

- [ ] `POST /operations/schedule-preview`

  Body:

  ```ts
  type SchedulePreviewRequest = {
    route_id: string;
    aircraft_id: string;
    days_of_week: number[];
    departure_local_time: string;
    turnaround_minutes?: number;
    starts_on?: string;
  };
  ```

  Ответ:
  - canActivate;
  - blocking reasons;
  - warnings;
  - generated sample flights;
  - weekly utilization;
  - expected weekly revenue/cost/profit;
  - aircraft utilization impact.

- [ ] `POST /operations/schedules`

  Создает и активирует schedule или создает draft.

  Для MVP можно делать сразу active, если checks passed:
  - route exists and belongs to airline;
  - route status is `awaiting_schedule` or `scheduled`;
  - aircraft belongs to airline;
  - aircraft compatible;
  - no aircraft time conflict;
  - airport slots available in MVP model;
  - route demand enough for selected frequency;
  - cash reserve above threshold.

- [ ] `GET /operations/schedules`

  Список расписаний airline.

- [ ] `GET /operations/schedules/:id`

  Деталь расписания + ближайшие рейсы.

- [ ] `PATCH /operations/schedules/:id`

  Для MVP:
  - pause/resume;
  - update pattern only if future flights can be regenerated;
  - cancel future generated flights when paused.

- [ ] `GET /operations/flights`

  Query:
  - `status`;
  - `route_id`;
  - `aircraft_id`;
  - `from`;
  - `to`;
  - `limit`.

  Ответ:
  - live;
  - upcoming;
  - completed;
  - summary counts.

- [ ] `POST /operations/flights/:id/complete`

  Для manual QA/demo можно добавить deterministic completion endpoint, если time-based completion неудобен. Endpoint должен быть dev/MVP-safe и idempotent: повторное completion не дублирует ledger.

### 3. Проверки ограничений

- [ ] Aircraft route compatibility.

  Проверить:
  - distance <= range;
  - origin runway >= min runway;
  - destination runway >= min runway;
  - aircraft status not maintenance;
  - maintenance ratio above threshold.

- [ ] Aircraft schedule conflict.

  Для каждого active schedule same aircraft:
  - рассчитать flight block time;
  - добавить turnaround before/after;
  - проверить overlap для ближайших 14 дней.

- [ ] Airport constraints.

  MVP checks:
  - origin/destination daily slot capacity;
  - night operations: если departure/arrival ночью и airport `works_at_night === false`, warning/block;
  - runway fees included in cost.

- [ ] Route demand/frequency fit.

  Если weekly offered seats сильно превышают weekly demand, warning `OVERSUPPLY_RISK`.

- [ ] Cash reserve check.

  До активации показать:
  - estimated weekly operating cost;
  - current MVP balance;
  - reserve after first week;
  - warning/block if negative or below threshold.

- [ ] Route state check.

  Нельзя активировать schedule для deleted/paused route. Если route already scheduled, разрешить update через edit flow, но не дублировать без предупреждения.

### 4. Flight generation

- [ ] Рассчитать block time.

  Формула MVP:
  - distance / cruising speed;
  - добавить taxi/turnaround buffer;
  - округлить до 5/15 минут.

- [ ] Генерировать flight numbers.

  Использовать airline IATA/ICAO:
  - если IATA есть: `XX101`;
  - иначе ICAO prefix;
  - стабильный sequence per route/schedule.

- [ ] Expected load factor.

  На основе:
  - daily demand route;
  - weekly frequency;
  - aircraft seats;
  - route reputation fallback;
  - clamp 35-95% для MVP.

- [ ] Expected financials per flight.

  Эти значения нужны TODO7:
  - passengers;
  - revenue;
  - airport fees;
  - fuel cost;
  - maintenance reserve;
  - total cost;
  - profit.

- [ ] Idempotency.

  Повторная генерация не должна создавать дубликаты flight instances для того же schedule/date/direction.

## Frontend: Operations / Schedule

### 1. Разделить `fleet-ops` по shellPath

- [ ] Сейчас Fleet & Ops remote обслуживает `/fleet/*` и `/operations/*`.

  Добавить route-aware rendering:
  - `/fleet/*` - fleet market/aircraft;
  - `/operations/schedule` - schedule builder/list;
  - `/operations/live-flights` - flight board;
  - `/operations/fuel`, `/operations/ground-services`, `/operations/research` - MVP disabled/empty states.

- [ ] Создать структуру:
  - `src/operations/api.ts`;
  - `src/operations/types.ts`;
  - `src/operations/i18n.ts`;
  - `src/operations/components/ScheduleBuilder.vue`;
  - `src/operations/components/SchedulePreview.vue`;
  - `src/operations/components/FlightBoard.vue`;
  - `src/operations/components/ScheduleList.vue`.

### 2. Schedule builder

- [ ] Entry state.

  Если есть route awaiting schedule, выбрать его по умолчанию. Если route_id передан через query/event, открыть его. Если маршрутов нет, показать empty state с CTA `/airports/routes`.

- [ ] Route selector.

  Показывать:
  - route pair;
  - status;
  - demand;
  - assigned/recommended aircraft;
  - next action.

- [ ] Aircraft selector.

  Показывать только owned aircraft, с badges:
  - compatible;
  - risky;
  - blocked.

  Для blocked aircraft показать причину.

- [ ] Frequency controls.

  MVP controls:
  - segmented control: daily / 3 weekly / weekly / custom;
  - custom day checkboxes;
  - departure time input;
  - turnaround select/stepper.

- [ ] Preview before activation.

  После изменения формы делать debounced `POST /operations/schedule-preview`. Показывать:
  - can activate;
  - warnings/blockers;
  - first generated flights;
  - weekly economics;
  - utilization.

- [ ] Activation.

  CTA disabled until no blockers. On success:
  - show success notification;
  - emit `schedule:activated`;
  - emit `game:snapshot-invalidated`;
  - navigate to `/operations/live-flights` or show created flights inline.

### 3. Flight board

- [ ] `/operations/live-flights` показывает flight board.

  Sections:
  - Live / Boarding;
  - Upcoming;
  - Completed;
  - Cancelled/Issues.

- [ ] Flight row/card.

  Minimum:
  - flight number;
  - route;
  - aircraft tail number;
  - departure/arrival;
  - status;
  - expected passengers/load factor;
  - expected revenue/cost/profit.

- [ ] Empty states.

  - no routes -> CTA route planning;
  - route exists no schedule -> CTA schedule builder;
  - schedule active no upcoming -> refresh/generate message.

- [ ] Manual completion for MVP/demo.

  If BFF exposes `POST /operations/flights/:id/complete`, add small action for scheduled/live flights in non-production or MVP mode. It must not be the only way to complete flights if time-based logic exists.

## Dashboard, Map, Events integration

- [ ] Dashboard summary.

  Update `/game/dashboard-summary`:
  - routes awaiting schedule count decreases;
  - upcoming flights count;
  - live flights count;
  - completed today;
  - next action becomes `VIEW_LIVE_FLIGHTS` or `CHECK_FINANCES`.

- [ ] Map state.

  Add route status:
  - scheduled/active route line style;
  - upcoming flights optional markers in MVP if available;
  - selected route/flight support.

- [ ] Events.

  Add events:
  - schedule activated;
  - first flights scheduled;
  - flight completed;
  - schedule blocked/risky.

- [ ] Event bus.

  Events:
  - `schedule:activated`;
  - `flight:completed`;
  - `operations:flight-selected`;
  - `finance:ledger-invalidated`;
  - `game:snapshot-invalidated`.

## I18N и тексты

- [ ] Добавить `ru/en` тексты operations.

  Категории:
  - schedule statuses;
  - flight statuses;
  - day names;
  - frequency modes;
  - blockers/warnings;
  - economics labels;
  - empty states;
  - CTA.

- [ ] Тексты должны объяснять решение.

  Примеры:
  - "Самолет занят в это время";
  - "Аэропорт назначения не работает ночью";
  - "Вы предлагаете больше мест, чем ожидаемый спрос";
  - "После первой недели останется примерно $...".

## Тесты

### BFF tests

- [ ] schedule options for route awaiting schedule.
- [ ] preview compatible daily schedule.
- [ ] preview blocks range/runway mismatch.
- [ ] preview warns oversupply.
- [ ] preview blocks aircraft conflict.
- [ ] create active schedule.
- [ ] generated flights are idempotent.
- [ ] flight status changes based on time.
- [ ] complete flight endpoint is idempotent.
- [ ] dashboard summary reflects active schedule/flights.

### Frontend tests

- [ ] schedule builder loads awaiting routes.
- [ ] route selector empty state links to route planning.
- [ ] aircraft selector shows blockers.
- [ ] preview renders weekly economics.
- [ ] activate schedule success navigates/updates state.
- [ ] flight board renders upcoming/live/completed.

### Manual QA

- [ ] Создать route в TODO5.
- [ ] Открыть `/operations/schedule`.
- [ ] Выбрать самолет, частоту, время.
- [ ] Увидеть preview и ограничения.
- [ ] Активировать расписание.
- [ ] Увидеть рейсы на `/operations/live-flights`.
- [ ] Dashboard показывает upcoming/live flights.

## Документация

- [ ] Обновить `docs/bff.md`: BFF-owned schedules/flights overlay.
- [ ] Обновить BFF OpenAPI overlay для `/operations/*`.
- [ ] Обновить future knowledge base: "Как запустить расписание".
- [ ] Отметить, что это MVP-simulation до появления backend schedule/flight endpoints.

## Порядок реализации

1. Добавить operations storage для schedules/flights.
2. Реализовать snapshot загрузку routes/fleet/airports.
3. Реализовать schedule checks.
4. Реализовать schedule preview.
5. Реализовать create/list schedule endpoints.
6. Реализовать flight generation/list/status.
7. Подключить Dashboard/Map/Events.
8. Разделить Fleet & Ops remote на fleet/operations views.
9. Реализовать schedule builder.
10. Реализовать flight board.
11. Добавить тесты и документацию.

## Definition of Done для TODO6

- [ ] Schedule/flight state хранится в BFF и изолирован по airline.
- [ ] Игрок может активировать простое расписание.
- [ ] Перед активацией видны blockers/warnings/economics.
- [ ] Ближайшие рейсы отображаются в Operations.
- [ ] Dashboard и Events отражают schedule/flight state.
- [ ] Финансовые expected values готовы для TODO7.
- [ ] Все тексты локализованы на `ru` и `en`.
- [ ] Есть BFF/frontend тесты.
