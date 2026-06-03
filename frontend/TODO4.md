# TODO4: Покупка первого самолета

Источник: раздел 4 `TODO_MVP.md` - "Покупка первого самолета".

Этот план создается заранее, до реализации разделов 2 и 3. Предполагаем, что к моменту реализации TODO4 уже будут готовы:

- раздел 2: Dashboard с реальным статусом компании и next-best-action;
- раздел 3: карта с базой, аэропортами и базовой визуализацией сети.

TODO4 не должен дублировать эти разделы. Он должен дать полноценный продуктовый сценарий покупки первого самолета и подготовить события/контракты, чтобы Dashboard и карта могли обновляться после покупки.

Backend не меняем. Все недостающие product-facing ответы, проверки, preview и обогащение данных реализуем через `frontend/bff`, максимально используя существующий backend:

- `GET /aircraft-types`;
- `GET /aircraft-types/{id}`;
- `POST /aircraft`;
- `GET /aircrafts`;
- `GET /aircraft/{id}`;
- `PATCH /aircraft/{id}`;
- `GET /airline/me`;
- `GET /airports`;
- BFF `GET /game/finance-overview`;
- BFF `GET /game/facilities-overview`;
- BFF onboarding/session данные, если они уже используются как источник airline/base context.

## Текущее состояние

- `apps/fleet-ops/src/RemoteApp.vue` уже показывает каталог типов самолетов.
- Есть фильтры по поиску, дальности, вместимости, цене и сортировка.
- Есть выбор базового аэропорта через `GET /airports`.
- Есть покупка самолета через `POST /aircraft`.
- Есть список купленных бортов через `GET /aircrafts`.
- Список aircraft types и airports сейчас используется как raw backend/BFF payload, без product-facing compatibility layer.
- Покупка происходит без полноценного preview последствий.
- Нет сравнения цены с балансом до покупки.
- Нет подтверждения покупки.
- Нет объяснения, почему самолет не подходит.
- Нет отдельной карточки самолета.
- Нет локализации remote-текстов.
- `RemoteApp.vue` уже слишком крупный и смешивает загрузку данных, фильтры, покупку, список бортов и UI.

## Продуктовая цель

Игрок после создания авиакомпании должен без помощи разработчика выбрать и купить первый подходящий самолет:

1. Открыть Fleet.
2. Понять свой бюджет и стартовую базу.
3. Увидеть каталог самолетов, отсортированный с учетом базы и денег.
4. Понять, какие самолеты подходят, какие не подходят и почему.
5. Выбрать самолет.
6. Увидеть последствия покупки: цена, остаток денег, пригодность к базе, операционный риск.
7. Подтвердить покупку.
8. Увидеть купленный самолет во флоте.
9. Получить следующий шаг: открыть направление/маршрут или карточку самолета.

## Обязательные продуктовые требования

- [ ] Игрок выбирает самолет под стартовую базу и бюджет.

  Каталог должен явно учитывать `airline.starting_airport_id`, баланс авиакомпании, параметры аэропорта и характеристики aircraft type.

- [ ] Каталог показывает пригодность самолета.

  Минимум:
  - цена;
  - дальность;
  - вместимость;
  - минимальная ВПП;
  - скорость;
  - fuel burn;
  - maintenance cost;
  - совместимость с выбранной базой;
  - доступность по бюджету;
  - краткий статус: `Recommended`, `Available`, `Risky`, `Blocked`.

- [ ] Неподходящие самолеты не просто исчезают.

  Игрок должен видеть причины:
  - ВПП базы короче минимальной;
  - не хватает денег;
  - слишком высокий риск остатка баланса;
  - база не работает ночью, если это важно для будущего расписания;
  - низкая slot capacity;
  - отсутствуют данные аэропорта или цены.

- [ ] Перед покупкой есть preview последствий.

  Минимум:
  - текущий баланс;
  - цена самолета;
  - остаток после покупки;
  - recommended cash reserve;
  - оценка дневного maintenance reserve;
  - оценка runway/base compatibility;
  - предупреждения;
  - финальное `canPurchase`.

- [ ] Покупка требует явного подтверждения.

  Кнопка `Buy aircraft` не должна сразу списывать деньги из карточки каталога. Нужен confirmation step/modal/panel с summary и предупреждениями.

- [ ] После покупки самолет появляется в owned fleet.

  В списке должны быть:
  - tail number;
  - модель;
  - база;
  - статус;
  - готовность к полету;
  - maintenance ratio;
  - следующий шаг: `Plan route`, `Open aircraft`, `Edit tail number`.

- [ ] Карточка самолета готова для MVP.

  Минимум:
  - модель;
  - регистрационный номер;
  - база;
  - статус;
  - in service;
  - вместимость;
  - дальность;
  - скорость;
  - текущие maintenance points;
  - max maintenance points;
  - total flight hours;
  - total cycles;
  - manufactured date;
  - назначенный маршрут или пустое состояние "Route assignment will appear after route planning".

- [ ] Редактирование tail number поддержано как полезное MVP-действие.

  В `TODO_MVP.md` оно не обязательное, если номер задается при покупке. Но backend уже поддерживает `PATCH /aircraft/{id}`, поэтому в план включаем это как часть карточки самолета, если не ломает сроки.

- [ ] Сценарий работает на desktop, tablet и mobile.

  Каталог, preview, confirmation и owned fleet не должны требовать широкой таблицы.

## BFF-first правило для TODO4

- [ ] UI Fleet & Ops не должен напрямую собирать product logic из raw backend endpoints.

  Даже если `game-sdk` ходит в BFF, сам UI не должен вручную склеивать `/aircraft-types`, `/airports`, `/aircrafts`, `/airline/me` и product warnings. Для MVP нужен BFF `fleet` module, который возвращает frontend-facing модель.

- [ ] Все новые Fleet endpoints создаем в `bff/src/modules/fleet`.

  Не добавлять логику покупки в `proxy`, потому что `proxy` должен оставаться generic forwarding/cache layer. Product composition должна жить в отдельном модуле.

- [ ] BFF использует уже существующий общий `requestBackend` / `requestBackendJson`.

  Покупка самолета - mutating request. По умолчанию не делать retry на `POST /aircraft` по backend `5xx`, если нет гарантии idempotency. Допустимо ретраить только safe GET preview/catalog endpoints.

- [ ] После успешной покупки BFF должен сбрасывать relevant caches.

  Минимум:
  - owned aircraft list;
  - finance overview/snapshot, если появится кэш;
  - dashboard snapshot, если он будет реализован в разделе 2;
  - events feed, если покупка добавляет synthetic event.

## BFF API plan

### 1. `GET /fleet/market`

- [ ] Добавить endpoint:

  ```http
  GET /fleet/market?base_airport_id=<id>&q=<query>&min_range=<km>&min_capacity=<seats>&max_price=<money>&sort=<recommended|price|capacity|range>
  ```

- [ ] Endpoint требует user token.

  Если token отсутствует или недействителен, вернуть normalized BFF error:

  ```json
  {
    "error": {
      "code": "AUTH_REQUIRED",
      "message": "Authentication required.",
      "retryable": false
    }
  }
  ```

- [ ] Endpoint должен собрать snapshot:

  - `GET /airline/me` с user token;
  - `GET /aircrafts` с user token;
  - `GET /aircraft-types` через BFF/admin-token/cache, если backend list недоступен обычному пользователю;
  - `GET /airports` через BFF/admin-token/cache;
  - starting airport из airline или `base_airport_id` override.

- [ ] Ответ должен быть product-facing:

  ```ts
  type FleetMarketResponse = {
    airline: {
      id?: string;
      name?: string;
      balance: number;
      starting_airport_id?: string;
    };
    baseAirport: FleetAirportCard | null;
    filters: {
      q?: string;
      min_range?: number;
      min_capacity?: number;
      max_price?: number;
      sort: string;
    };
    summary: {
      totalTypes: number;
      visibleTypes: number;
      affordableTypes: number;
      baseCompatibleTypes: number;
      recommendedTypeId?: string;
    };
    aircraftTypes: FleetMarketAircraftType[];
    ownedAircraft: FleetOwnedAircraftCard[];
  };
  ```

- [ ] `FleetMarketAircraftType` должен включать:

  - backend `id`;
  - `model_name`;
  - `iata_code`;
  - `icao_code`;
  - `price_per_unit`;
  - `max_planned_seat_capacity`;
  - `max_range_km`;
  - `cruising_speed_kph`;
  - `min_runway_length_m`;
  - `fuel_consumption_per_hour`;
  - `base_maintenance_points`;
  - `maint_cost_per_flight_hour`;
  - `base_turnaround_points`;
  - `compatibility.status`;
  - `compatibility.canUseBase`;
  - `compatibility.canAfford`;
  - `compatibility.canPurchase`;
  - `compatibility.score`;
  - `compatibility.warnings`;
  - `preview.remainingBalance`;
  - `preview.cashReserveWarning`;
  - `preview.estimatedDailyMaintenanceReserve`.

- [ ] Добавить статус пригодности.

  Предлагаемая модель:

  - `recommended`: подходит к базе, хватает денег, остаток выше reserve threshold;
  - `available`: можно купить, но есть мягкие предупреждения;
  - `risky`: можно купить, но остаток денег ниже recommended reserve или высокие операционные расходы;
  - `blocked`: нельзя купить или нельзя использовать на базе.

- [ ] Реализовать ранжирование `recommended`.

  Рекомендуемый score:

  - `+` доступен по цене;
  - `+` подходит по ВПП;
  - `+` вместимость 70-220 мест для первого самолета;
  - `+` дальность 1500-7000 км;
  - `+` ниже maintenance/fuel cost;
  - `-` слишком дорогой для стартового баланса;
  - `-` widebody/very large aircraft как первый самолет;
  - `-` runway requirement близок к лимиту базы;
  - `-` отсутствует критичное поле цены/дальности.

  Точные веса можно хранить в BFF helper `fleet/scoring.ts`.

### 2. `GET /fleet/purchase-preview`

- [ ] Добавить endpoint:

  ```http
  GET /fleet/purchase-preview?aircraft_type_id=<id>&base_airport_id=<id>&tail_number=<value>
  ```

- [ ] Endpoint должен проверить:

  - пользователь авторизован;
  - airline существует;
  - aircraft type существует;
  - base airport существует;
  - tail number валиден по frontend/BFF правилам;
  - tail number не конфликтует с уже купленными бортами пользователя;
  - база совместима по ВПП;
  - баланс >= price;
  - остаток после покупки не уходит ниже мягкого reserve threshold.

- [ ] Ответ:

  ```ts
  type FleetPurchasePreviewResponse = {
    canPurchase: boolean;
    blockingReasons: FleetPurchaseReason[];
    warnings: FleetPurchaseReason[];
    airlineBalance: number;
    aircraftPrice: number;
    remainingBalance: number;
    recommendedReserve: number;
    estimatedDailyMaintenanceReserve: number;
    aircraftType: FleetMarketAircraftType;
    baseAirport: FleetAirportCard;
    tailNumber: {
      value: string;
      normalizedValue: string;
      valid: boolean;
      conflict: boolean;
    };
  };
  ```

- [ ] Tail number validation должна учитывать страну/базу, если доступен `country.aircraft_tail_code`.

  На MVP достаточно:
  - trim;
  - uppercase;
  - 2-12 символов;
  - буквы/цифры/дефис;
  - проверка уникальности среди `/aircrafts`.

  Если country tail code доступен через airport -> country, добавить подсказку: например, suggested prefix.

- [ ] Preview не должен мутировать backend.

  Только read-only запросы и BFF расчеты.

### 3. `POST /fleet/aircraft`

- [ ] Добавить product-facing endpoint покупки:

  ```http
  POST /fleet/aircraft
  {
    "aircraft_type_id": "...",
    "base_airport_id": "...",
    "tail_number": "HL-001"
  }
  ```

- [ ] Endpoint должен повторить все проверки preview.

  Нельзя полагаться только на frontend disabled button. Если preview говорит `canPurchase=false`, purchase endpoint должен вернуть `400` с normalized reasons.

- [ ] Endpoint вызывает backend `POST /aircraft`.

  Payload:

  ```json
  {
    "aircraft_type_id": "...",
    "base_airport_id": "...",
    "tail_number": "..."
  }
  ```

  `current_owner_id` не отправлять из UI/BFF, если backend берет владельца из token.

- [ ] Не делать unsafe retry на `POST /aircraft`.

  Если backend вернул `500`, BFF должен вернуть retryable error, но не повторять покупку автоматически без idempotency.

- [ ] После backend success загрузить созданный самолет.

  Если backend вернул `id`, вызвать `GET /aircraft/{id}` и вернуть enriched card.

  Если `id` отсутствует, fallback:
  - обновить `/aircrafts`;
  - найти по normalized tail number;
  - если не найдено, вернуть success с `id` null и рекомендацией refresh.

- [ ] Ответ должен включать следующий шаг.

  Например:

  ```ts
  {
    aircraft: FleetOwnedAircraftCard;
    finance: {
      previousBalance?: number;
      currentBalance?: number;
      aircraftPrice: number;
    };
    event: {
      type: "AIRCRAFT_PURCHASED";
      title: string;
      severity: "success";
    };
    recommendedNextAction: {
      labelKey: "fleet.next.planRoute";
      route: "/airports/routes";
    };
  }
  ```

  Если раздел 5 еще не готов, route может вести в `/airports/hubs` или future route, но action должен быть понятным.

- [ ] Нормализовать ошибки:

  - `FLEET_AIRCRAFT_TYPE_NOT_FOUND`;
  - `FLEET_BASE_AIRPORT_NOT_FOUND`;
  - `FLEET_RUNWAY_TOO_SHORT`;
  - `FLEET_INSUFFICIENT_FUNDS`;
  - `FLEET_TAIL_NUMBER_INVALID`;
  - `FLEET_TAIL_NUMBER_EXISTS`;
  - `FLEET_BACKEND_UNAVAILABLE`;
  - `AUTH_REQUIRED`.

### 4. `GET /fleet/aircraft`

- [ ] Добавить endpoint enriched owned fleet:

  ```http
  GET /fleet/aircraft
  ```

- [ ] Ответ должен склеивать:

  - `/aircrafts`;
  - `/aircraft-types`;
  - `/airports`;
  - будущие route assignments, когда разделы 5/6 будут готовы.

- [ ] Каждый aircraft card должен содержать:

  - id;
  - tail number;
  - status;
  - in service;
  - model;
  - type codes;
  - base airport label;
  - maintenance ratio;
  - total flight hours;
  - total cycles;
  - canAssignToRoute boolean or placeholder;
  - recommended action.

- [ ] Empty state должен быть product-facing.

  Если самолетов нет, ответ может включать:

  ```ts
  emptyState: {
    code: "NO_AIRCRAFT";
    recommendedActionRoute: "/fleet/overview";
  }
  ```

### 5. `GET /fleet/aircraft/{id}`

- [ ] Добавить enriched aircraft detail endpoint.

  Использовать backend `GET /aircraft/{id}` и обогатить type/base данными.

- [ ] Ответ должен включать MVP-карточку:

  - aircraft;
  - type;
  - base airport;
  - maintenance status;
  - operating limits;
  - route assignment placeholder;
  - actions.

- [ ] Если aircraft не принадлежит пользователю или не найден, вернуть normalized `404`.

### 6. `PATCH /fleet/aircraft/{id}/tail-number`

- [ ] Добавить BFF wrapper над backend `PATCH /aircraft/{id}`.

- [ ] BFF валидирует и нормализует tail number до отправки.

- [ ] После success вернуть обновленную enriched aircraft card.

- [ ] Ошибки:

  - invalid tail number;
  - conflict;
  - unauthorized;
  - not found.

## BFF implementation details

- [ ] Создать структуру:

  ```text
  bff/src/modules/fleet/
    index.ts
    types.ts
    scoring.ts
    preview.ts
    tail-number.ts
    errors.ts
  ```

- [ ] Подключить `handleFleetRequest` в `bff/src/server.ts`.

  Порядок до generic proxy:

  ```ts
  handleOnboardingRequest
  handleGameRequest
  handleFleetRequest
  handleProxyRequest
  ```

  Или до `handleGameRequest`, если fleet endpoints используют собственные routes. Главное - до `proxy`, чтобы `/fleet/*` не пытался уйти в backend напрямую.

- [ ] Использовать `getCachedListInternal` аккуратно.

  Для aircraft types, airports, countries можно использовать proxy cache. Для пользовательских aircrafts и airline нельзя глобально кэшировать без user scope.

- [ ] Добавить user-scoped short cache только если реально нужно.

  Для MVP можно обойтись без user cache. Если добавляем cache, ключ должен включать user/airline id.

- [ ] Не смешивать route/schedule future logic в fleet purchase.

  До разделов 5/6 route assignment остается placeholder. Но BFF response должен предусмотреть поле `assignment`, чтобы потом не ломать UI.

## Frontend plan: Fleet & Ops

### 1. Разделить `RemoteApp.vue`

- [ ] Убрать монолитную реализацию из одного файла.

  Предлагаемая структура:

  ```text
  apps/fleet-ops/src/
    RemoteApp.vue
    api/fleetApi.ts
    i18n/en.ts
    i18n/ru.ts
    i18n/messages.ts
    composables/useFleetMarket.ts
    composables/usePurchasePreview.ts
    components/FleetMarketHeader.vue
    components/FleetFilters.vue
    components/AircraftTypeCard.vue
    components/AircraftCompatibilityBadge.vue
    components/PurchasePanel.vue
    components/PurchaseConfirmation.vue
    components/OwnedAircraftList.vue
    components/OwnedAircraftCard.vue
    components/AircraftDetailPanel.vue
    components/TailNumberEditor.vue
    types.ts
  ```

- [ ] `RemoteApp.vue` должен быть orchestration layer.

  Он выбирает view по `shellPath`:
  - `/fleet/overview` -> market + owned summary;
  - `/fleet/aircraft` -> owned fleet;
  - `/fleet/aircraft/:id` or selected state -> aircraft detail;
  - `/fleet/orders`, `/fleet/configurations`, `/fleet/maintenance` -> MVP-safe empty/disabled states, если не реализуются сейчас.

### 2. Fleet market

- [ ] Заменить ручную сборку данных в UI на `GET /fleet/market`.

- [ ] Фильтры отправлять в BFF или применять локально только поверх уже product-facing ответа.

  Если список aircraft types небольшой, допустима локальная фильтрация после BFF enrich. Но source of truth для compatibility должен быть BFF.

- [ ] Добавить status bands в каталоге.

  Пример группировки:
  - Recommended for your base;
  - Available;
  - Risky;
  - Blocked.

  Можно реализовать как сортировку + badges, без сложных tabs.

- [ ] Карточка aircraft type должна показывать:

  - модель;
  - price;
  - seats;
  - range;
  - runway required vs base runway;
  - cruise speed;
  - fuel burn;
  - estimated maintenance;
  - compatibility badge;
  - warning chips;
  - CTA `Review purchase`.

- [ ] Заблокированные самолеты должны иметь CTA `View reasons`, а не `Buy`.

  Игрок должен понять, что надо изменить: выбрать другую базу, накопить деньги, выбрать меньший самолет.

### 3. Purchase preview and confirmation

- [ ] При выборе самолета открыть purchase panel.

  На desktop это может быть правый panel. На mobile - full-width stacked panel ниже карточки или modal/drawer.

- [ ] Purchase panel должен загружать `/fleet/purchase-preview`.

  Preview обновляется при изменении:
  - aircraft type;
  - base airport;
  - tail number.

- [ ] Добавить tail number ввод.

  Поведение:
  - uppercase;
  - trim;
  - подсказка по формату;
  - validation error inline;
  - conflict warning из preview.

- [ ] Добавить base airport selector только если нужно.

  Для первого самолета default = starting base. Можно разрешить выбрать другую базу, но UI должен объяснять, что это база самолета, не обязательно стартовый hub. Если раздел 3 уже умеет выбирать аэропорт на карте, поддержать event-bus preselect.

- [ ] Добавить confirmation step.

  Содержание:
  - aircraft model;
  - tail number;
  - base airport;
  - price;
  - remaining balance;
  - warnings;
  - checkbox/explicit acknowledge только для risky purchase;
  - primary CTA `Confirm purchase`.

- [ ] После success:

  - закрыть confirmation;
  - показать success state/toast;
  - обновить market и owned fleet;
  - emit event bus;
  - показать next action.

### 4. Owned fleet

- [ ] Использовать `GET /fleet/aircraft` вместо raw `/aircrafts`.

- [ ] Owned aircraft card должна показывать:

  - tail number;
  - model;
  - base;
  - status;
  - maintenance badge;
  - in service;
  - next action.

- [ ] Empty state:

  Если самолетов нет:
  - объяснить, зачем нужен первый самолет;
  - CTA на market;
  - secondary link на knowledge base article, если раздел базы знаний уже есть.

- [ ] После покупки список должен обновляться без полного reload страницы.

### 5. Aircraft detail

- [ ] Добавить detail panel/page.

  MVP вариант:
  - открыть справа при выборе card;
  - или route-driven detail внутри `/fleet/aircraft`.

- [ ] Detail загружает `GET /fleet/aircraft/{id}`.

- [ ] Карточка деталей должна показывать:

  - general info;
  - technical limits;
  - maintenance;
  - base;
  - lifecycle counters;
  - route assignment placeholder;
  - actions.

- [ ] Добавить tail number editor.

  UX:
  - edit icon/button;
  - inline form;
  - save/cancel;
  - validation;
  - conflict error;
  - optimistic update только после success или conservative update после response.

## Интеграция с Dashboard и картой

- [ ] После покупки emit event-bus событие.

  Предлагаемый event:

  ```ts
  airlineSimEventBus.emit("fleet:aircraft-purchased", {
    aircraftId,
    tailNumber,
    typeId,
    modelName,
    baseAirportId,
    price,
  });
  ```

- [ ] После покупки emit generic refresh events.

  Чтобы разделы 2/3 могли обновиться:

  - `game:snapshot-invalidated`;
  - `dashboard:refresh-requested`;
  - `map:aircraft-added` или `map:network-refresh-requested`.

  Если в разделах 2/3 уже будет другой event contract, использовать его.

- [ ] Fleet должен принимать preselected base airport от карты.

  Если карта из раздела 3 отправляет `airport:selected` или `fleet:base-preselected`, purchase panel должен уметь подставить base airport, но не обязан менять starting base airline.

- [ ] Dashboard next-best-action после покупки должен перейти к планированию маршрута.

  TODO4 только эмитит событие/обновляет state; actual dashboard logic остается в разделе 2.

## I18N

- [ ] Добавить локализацию в `apps/fleet-ops`.

  Сейчас remote содержит английские строки напрямую. Для MVP нужно сделать локальный словарь `en/ru` и использовать `appLocale`.

- [ ] Добавить ключи:

  - titles: aircraft market, owned fleet, purchase preview, confirmation, aircraft detail;
  - filters;
  - metrics: price, seats, range, runway, speed, fuel burn, maintenance;
  - statuses: recommended, available, risky, blocked, owned, in service, maintenance;
  - warnings/reasons;
  - buttons: review purchase, confirm purchase, cancel, refresh, open aircraft, plan route, edit tail number;
  - errors;
  - empty states;
  - success messages.

- [ ] Все numbers/money/dates форматировать locale-aware.

  Использовать `Intl.NumberFormat(appLocale, ...)`, а не hardcoded `"en"`.

## UI-kit tasks

- [ ] Проверить, хватает ли текущих компонентов `air-ui`.

  Сейчас есть `AirButton`, `AirBadge`, `AirSelect`, `AirTextField`, `AirMetricCard`, `AirIconButton`.

- [ ] Добавить общий confirmation/dialog компонент, если его нет.

  Возможные компоненты:
  - `AirModal`;
  - `AirDrawer`;
  - `AirConfirmDialog`.

  Для mobile purchase confirmation drawer удобнее, но если времени мало, можно сделать local component в `fleet-ops` и позже вынести.

- [ ] Если добавляем компонент в `packages/air-ui`, обязательно добавить Storybook story.

  Состояния:
  - default;
  - danger/risky confirmation;
  - loading;
  - disabled primary action;
  - long content;
  - mobile/narrow.

- [ ] Не создавать карточки внутри карточек.

  Каталог может быть сеткой cards; purchase panel и owned list должны быть отдельными surfaces, без nested card-heavy layout.

## Tail number rules

- [ ] BFF и UI должны использовать одинаковую нормализацию.

  Правило:
  - trim;
  - uppercase;
  - multiple spaces запрещены;
  - допустимы `A-Z`, `0-9`, `-`;
  - длина 2-12;
  - уникальность среди owned aircraft.

- [ ] UI должен показывать suggested examples.

  Если у страны есть `aircraft_tail_code`, использовать его. Если нет:
  - fallback примеры: `HL-001`, `TC-001`, `N-001`;
  - не хардкодить один пример как обязательный.

- [ ] Ошибки tail number:

  - empty;
  - too short;
  - too long;
  - invalid characters;
  - already exists.

## Проверки и ограничения покупки

- [ ] Бюджет.

  `canAfford = airline.balance >= aircraftType.price_per_unit`.

- [ ] Recommended reserve.

  MVP формула в BFF:

  ```text
  recommendedReserve = max(5_000_000, aircraftPrice * 0.1, estimatedDailyMaintenanceReserve * 14)
  ```

  Если remaining balance ниже reserve, покупка не блокируется, но получает `risky`.

- [ ] ВПП.

  `canUseBase = baseAirport.max_runway_length_m >= aircraftType.min_runway_length_m`.

  Если поле отсутствует, статус не `recommended`; warning `MISSING_RUNWAY_DATA`.

- [ ] Slots.

  Пока нет route/schedule usage. Для MVP:
  - `LOW_SLOT_CAPACITY` warning, если `max_runway_uses_per_day` ниже порога;
  - не блокировать покупку только из-за slots, пока нет расписаний.

- [ ] Night operations.

  Не блокировать покупку, но показывать warning, что будущие расписания будут ограничены.

- [ ] Maintenance/fuel risk.

  Считать approximate operating cost:

  ```text
  estimatedDailyMaintenanceReserve = maint_cost_per_flight_hour * 8
  estimatedFuelBurnPerDay = fuel_consumption_per_hour * 8
  ```

  Fuel money cost можно оставить как qualitative warning, если нет стабильного fuel price.

- [ ] Overpowered first aircraft.

  Для первого самолета widebody/очень дорогие самолеты не блокировать, если хватает денег и база подходит, но показывать warning `LARGE_AIRCRAFT_FIRST_PURCHASE`.

## Ошибки и empty states

- [ ] Market loading.

  Показывать skeleton/loader без layout shift.

- [ ] Market backend unavailable.

  Human message + retry button.

- [ ] No aircraft types.

  Объяснить, что каталог пуст или world data не загружены; CTA refresh.

- [ ] No compatible aircraft.

  Объяснить, что база ограничивает выбор; предложить:
  - убрать фильтры;
  - выбрать другой base airport для самолета;
  - открыть Facilities, если раздел 9 уже доступен;
  - открыть базу знаний, если раздел 13 готов.

- [ ] No owned aircraft.

  CTA `Choose first aircraft`.

- [ ] Purchase conflict.

  Tail number conflict должен оставлять форму заполненной и фокусировать поле tail number.

- [ ] Purchase backend failure.

  Если неизвестно, была ли покупка выполнена, UI должен предложить refresh owned fleet, а не повторять POST автоматически.

## Тесты BFF

- [ ] `GET /fleet/market`:
  - unauthorized;
  - airline without starting airport;
  - normal response;
  - filters;
  - recommended sort;
  - blocked by runway;
  - blocked by budget;
  - risky by reserve.

- [ ] `GET /fleet/purchase-preview`:
  - valid purchase;
  - insufficient funds;
  - runway too short;
  - invalid tail number;
  - tail number conflict;
  - missing aircraft type;
  - missing base airport.

- [ ] `POST /fleet/aircraft`:
  - validation repeats preview checks;
  - success calls backend once;
  - no unsafe retry for backend `500`;
  - conflict maps to `FLEET_TAIL_NUMBER_EXISTS`;
  - success returns enriched aircraft.

- [ ] `GET /fleet/aircraft`:
  - empty state;
  - enriches model/base;
  - maintenance ratio.

- [ ] `GET /fleet/aircraft/{id}`:
  - success;
  - not found;
  - unauthorized.

- [ ] `PATCH /fleet/aircraft/{id}/tail-number`:
  - validation;
  - backend conflict;
  - success enriched response.

## Тесты frontend

- [ ] `useFleetMarket`:
  - loads market;
  - applies filters;
  - handles error;
  - refreshes after purchase.

- [ ] `usePurchasePreview`:
  - debounces tail number;
  - updates preview when selected type/base changes;
  - handles blocking reasons.

- [ ] `AircraftTypeCard`:
  - recommended state;
  - risky state;
  - blocked state;
  - long model name;
  - mobile layout.

- [ ] `PurchaseConfirmation`:
  - confirm disabled when blocked;
  - risky acknowledge requirement;
  - loading state;
  - success callback.

- [ ] `OwnedAircraftList`:
  - empty;
  - after purchase item appears;
  - card action emits/open detail.

- [ ] `AircraftDetailPanel`:
  - renders technical details;
  - renders route placeholder;
  - tail number edit success/error.

- [ ] i18n:
  - all new keys exist in `en` and `ru`;
  - no direct English user-facing strings remain in fleet components.

## Manual QA

- [ ] New airline with no aircraft opens Fleet and sees first-aircraft guidance.
- [ ] User sees budget and starting base in market header.
- [ ] User filters aircraft by range/capacity/price.
- [ ] User can see why an aircraft is blocked.
- [ ] User can open purchase preview for recommended aircraft.
- [ ] User sees remaining balance before confirmation.
- [ ] User cannot confirm invalid tail number.
- [ ] User cannot confirm runway-incompatible aircraft.
- [ ] User can confirm valid purchase.
- [ ] Purchased aircraft appears without full page reload.
- [ ] Dashboard refresh event is emitted after purchase.
- [ ] Map/network refresh event is emitted after purchase.
- [ ] Mobile viewport completes purchase flow without horizontal overflow.
- [ ] Backend unavailable during preview shows retryable human error.
- [ ] Backend failure after POST does not auto-repeat unsafe purchase.

## Документация

- [ ] Обновить `docs/bff.md`.

  Добавить:
  - `fleet` module;
  - endpoints;
  - purchase preview contract;
  - no unsafe retry rule for `POST /fleet/aircraft`;
  - reason/warning code list.

- [ ] Обновить `AGENTS.md`, если добавляется `bff/src/modules/fleet`.

  В структуре указать новый модуль и источник истины.

- [ ] Обновить или создать product docs для базы знаний.

  Минимум статьи:
  - "Как купить первый самолет";
  - "Почему самолет может не подходить";
  - "Что означает остаток баланса после покупки";
  - "Что такое регистрационный номер самолета".

  Если раздел базы знаний еще не реализован, подготовить markdown/content source там, где будет выбран источник контента.

## Порядок реализации

1. Создать BFF `fleet` module и типы product-facing ответов.
2. Реализовать scoring/compatibility helpers.
3. Реализовать `GET /fleet/market`.
4. Реализовать `GET /fleet/purchase-preview`.
5. Реализовать `POST /fleet/aircraft` без unsafe retry.
6. Реализовать `GET /fleet/aircraft`.
7. Реализовать `GET /fleet/aircraft/{id}`.
8. Реализовать `PATCH /fleet/aircraft/{id}/tail-number`, если помещается в MVP объем.
9. Добавить BFF tests.
10. Разделить `apps/fleet-ops/src/RemoteApp.vue` на компоненты/composables.
11. Перевести Fleet UI на `/fleet/*` BFF endpoints.
12. Добавить purchase preview и confirmation flow.
13. Добавить owned fleet и aircraft detail.
14. Добавить event-bus интеграцию с Dashboard/Map contracts.
15. Добавить RU/EN локализацию.
16. Добавить frontend tests.
17. Обновить docs.
18. Запустить проверки:
    - `bun --cwd bff run test`;
    - `bun --cwd apps/fleet-ops run test`;
    - `bun run lint`.

## Definition of Done для TODO4

- [ ] Fleet UI не использует raw `/aircraft-types`, `/airports`, `/aircrafts`, `/aircraft` напрямую для продуктовой логики покупки.
- [ ] Есть BFF `fleet` module с market, preview, purchase и aircraft detail/list endpoints.
- [ ] Каталог показывает пригодность самолета к базе и бюджету.
- [ ] Неподходящие самолеты имеют объяснимые причины.
- [ ] Перед покупкой игрок видит цену, остаток денег и риски.
- [ ] Покупка требует подтверждения.
- [ ] Unsafe automatic retry для `POST /aircraft` отсутствует.
- [ ] После покупки самолет появляется во флоте без ручного refresh.
- [ ] Есть MVP-карточка самолета.
- [ ] Tail number валидируется и конфликт обрабатывается.
- [ ] После покупки отправляются события для Dashboard/Map refresh.
- [ ] Все пользовательские тексты Fleet purchase flow локализованы на `ru` и `en`.
- [ ] Сценарий покупки первого самолета проходит на desktop и mobile.
- [ ] Есть BFF и frontend тесты на ключевые состояния.
- [ ] Документация BFF и пользовательская документация обновлены.

## Зависимости от разделов 2 и 3

- Dashboard из раздела 2 должен уметь обновлять баланс, количество самолетов и next-best-action после события покупки.
- Dashboard должен после первой покупки предлагать переход к планированию маршрута.
- Карта из раздела 3 должна уметь подсветить базу самолета или обновить fleet layer после покупки.
- Если к моменту реализации TODO4 события Dashboard/Map будут называться иначе, использовать фактический event contract разделов 2 и 3.
- TODO4 не блокируется отсутствием route/schedule backend: route assignment в карточке самолета остается пустым состоянием до разделов 5 и 6.
