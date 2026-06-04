# TODO5: Планирование маршрута

Источник: раздел 5 `TODO_MVP.md` — «Планирование маршрута».

Разделы 1–4 считаются реализованными. Игрок уже создал авиакомпанию, выбрал базу, видит Dashboard/карту и купил минимум один самолет.

Backend не меняем. Все отсутствующие backend-возможности реализуем в BFF, максимально используя существующие backend-данные. Любой browser-facing запрос идет только в BFF. BFF вызывает backend через общий `requestBackend` / `requestBackendJson` с централизованными timeout, нормализацией ошибок и retry-политикой.

## Результат раздела

Игрок должен пройти путь от вопроса «куда летать?» до сохраненного маршрута, который готов к созданию расписания:

1. Открыть планировщик и сразу увидеть направления из своей стартовой базы.
2. Сравнить направления по спросу, совместимости, ограничениям и ожидаемой экономике.
3. Выбрать направление и конкретный самолет.
4. Понять рекомендацию и причины риска или блокировки.
5. Создать маршрут.
6. Увидеть маршрут в списке, Dashboard и на карте.
7. Перейти к созданию расписания.

Финальное состояние успешного сценария: маршрут сохранен со статусом `awaiting_schedule`.

## Что уже реализовано

- [x] BFF-модуль `bff/src/modules/routes`.
- [x] BFF-owned маршруты в `bff/data/game-state/routes.json`, изолированные по `airline_id`.
- [x] Атомарная запись через временный файл и rename.
- [x] Endpoints:
  - `GET /routes/opportunities`;
  - `GET /routes/opportunities/:destinationAirportId/preview`;
  - `POST /routes`;
  - `GET /routes`;
  - `GET /routes/:id`;
  - `PATCH /routes/:id`;
  - `DELETE /routes/:id`.
- [x] Расчет дистанции, спроса, совместимости самолетов, rough economics и рекомендации.
- [x] Network Planner показывает opportunities, фильтры, preview и список сохраненных маршрутов.
- [x] После создания отправляются события обновления Dashboard и карты.
- [x] Dashboard и map-state читают BFF-owned маршруты.
- [x] Базовая локализация Network Planner на `ru` и `en`.

## Главные пробелы текущего baseline

- [ ] Создание маршрута недостаточно защищено от устаревшего preview и конкурентного повторного запроса.
- [ ] Нет явного подтверждения создания рискованного маршрута.
- [ ] Маршрут с blockers сейчас может сохраниться как draft без отдельного осознанного пользовательского сценария.
- [ ] Нет полноценной карточки маршрута, редактирования draft и обновления demand/economics snapshot.
- [ ] Фильтры не включают сортировку, выбранный самолет, существующие маршруты и причины исключения.
- [ ] Текущая экономика является оценкой, но UI недостаточно объясняет допущения и confidence.
- [ ] Спрос и экономика могут дублироваться между `demand`, `game` и `routes`; нужен единый источник расчетов.
- [ ] Файловое хранилище не защищено от параллельных read-modify-write операций.
- [ ] BFF-контракты частично описаны вручную в MFE и могут разойтись.
- [ ] Нет достаточного набора route-specific BFF и UI-тестов.

## Обязательные архитектурные работы

### 1. BFF-first и отсутствие прямых backend-запросов

- [ ] Провести аудит `apps/network-planner`, связанных shell/map компонентов и shared-пакетов.
- [ ] Удалить или заменить любой прямой вызов backend URL, raw backend endpoint или самостоятельную композицию backend DTO.
- [ ] Network Planner должен использовать только продуктовые BFF endpoints `/routes/*`.
- [ ] Общие справочные данные должны приходить внутри route read model или через BFF, а не отдельными browser-запросами к backend.
- [ ] Добавить автоматическую проверку, запрещающую `VITE_BACKEND_URL` и прямой backend host в browser-facing коде.

### 2. Retry и ошибки в BFF

- [ ] Все backend-чтения routes snapshot выполнять через `requestBackendJson`.
- [ ] Для безопасных `GET`/`HEAD` применять существующие retry: до 3 попыток, timeout, exponential backoff с jitter.
- [ ] Не ретраить backend mutations без idempotency guarantee.
- [ ] Для BFF-owned `POST /routes` добавить клиентский `Idempotency-Key` или `client_request_id`, чтобы повтор после сетевой ошибки не создавал дубль.
- [ ] Нормализовать ошибки: `AUTH_REQUIRED`, `BACKEND_UNAVAILABLE`, `ROUTE_NOT_FOUND`, `ROUTE_DUPLICATE`, `ROUTE_BLOCKED`, `ROUTE_STALE_PREVIEW`, `ROUTE_STORAGE_UNAVAILABLE`.
- [ ] Возвращать `retryable`, `reason_codes` и безопасный пользовательский следующий шаг.
- [ ] UI показывает локализованное сообщение и Retry только для retryable ошибок.

### 3. Надежность BFF-owned state

- [ ] Добавить общий serialized write queue/mutex для `routes.json`, чтобы параллельные записи не теряли данные.
- [ ] Валидировать JSON при чтении; corrupt-файл не заменять пустым состоянием молча.
- [ ] Добавить `schema_version`, миграции и резервную копию перед миграцией.
- [ ] Добавить audit-поля: `created_by`, `last_action`, `revision`.
- [ ] Использовать optimistic concurrency для PATCH/DELETE через `revision`.
- [ ] Зафиксировать план миграции BFF routes в backend, когда появятся route endpoints.

## Полный BFF-план

### 1. Единый route planning read model

- [ ] Выделить единые функции спроса, дистанции, совместимости и экономики; `game/network-opportunities` не должен считать альтернативную модель.
- [ ] `GET /routes/opportunities` должен поддерживать:
  - origin из стартовой базы по умолчанию;
  - `aircraft_id`;
  - `min_demand`;
  - `max_distance`;
  - `only_compatible`;
  - `only_profitable`;
  - `exclude_existing`;
  - `sort=recommended|demand|profit|distance|slots`;
  - cursor/limit.
- [ ] Для каждого направления вернуть:
  - аэропорты и человекочитаемые labels;
  - спрос туда/обратно;
  - дистанцию и расчетную длительность;
  - compatible/risky/blocked owned aircraft;
  - аэропортовые ограничения;
  - estimated fare, load, revenue, costs, profit;
  - confidence и причины низкой уверенности;
  - recommendation и reason codes;
  - existing route state.
- [ ] Различать blocker, warning и informational insight.
- [ ] Не скрывать направления без данных: показывать их с низкой confidence и объяснением.

### 2. Preview и рекомендация

- [ ] Preview пересчитывается для выбранного конкретного самолета и частоты.
- [ ] Добавить recommended frequency и диапазон частот, поддерживаемый спросом.
- [ ] Добавить weekly offered seats, expected passengers и oversupply risk.
- [ ] Показывать запас дальности и ВПП численно, а не только статусом.
- [ ] Показывать аэропортовые сборы и ограничения ночных операций.
- [ ] Recommendation:
  - `open`: нет blockers, положительная оценка, достаточно спроса;
  - `risky`: маршрут допустим, но есть предупреждения;
  - `blocked`: маршрут нельзя активировать;
  - `insufficient_data`: не хватает данных для надежной рекомендации.
- [ ] Preview получает `snapshot_version`/`calculated_at`; create повторно валидирует данные.

### 3. Создание и управление маршрутом

- [ ] `POST /routes` повторяет все проверки preview.
- [ ] Для `risky` требовать `acknowledged_warning_codes`.
- [ ] Для `blocked` разрешать только явное `save_as_draft=true`; обычное создание возвращает `ROUTE_BLOCKED`.
- [ ] Запретить дубликаты пары в обоих направлениях согласно согласованному продуктовому правилу.
- [ ] Сохранять выбранный самолет, частоту, snapshot спроса/экономики и причины рекомендации.
- [ ] После создания вернуть route card, next action и invalidation metadata.
- [ ] `PATCH /routes/:id` поддерживает:
  - выбор/замену самолета до активного расписания;
  - изменение базовой частоты;
  - refresh snapshot;
  - pause/resume только при согласовании с TODO6;
  - optimistic concurrency.
- [ ] `DELETE /routes/:id` разрешен только без расписаний, будущих и выполненных рейсов.
- [ ] Добавить route detail endpoint с schedule/flight/finance summaries из TODO6–7.

### 4. Целостность между разделами

- [ ] Dashboard считает draft/awaiting/scheduled/active routes из одного route store.
- [ ] Map показывает созданный маршрут сразу после успешного ответа BFF.
- [ ] Fleet aircraft detail показывает назначенный маршрут.
- [ ] Schedule options используют именно сохраненный route snapshot.
- [ ] Finance route profitability связывается с route id и показывает labels аэропортов.
- [ ] Удаление/изменение маршрута проверяет зависимости в operations и finance.

## Полный UX-план Network Planner

### 1. Структура экрана

- [ ] Разделить интерфейс на понятные режимы:
  - «Возможности»;
  - «Мои маршруты»;
  - detail/preview выбранного маршрута.
- [ ] По умолчанию показывать стартовую базу и объяснять, почему origin зафиксирован.
- [ ] Сохранять фильтры и выбранное направление при возврате из Fleet/Map.
- [ ] Поддержать deep links: `destination_id`, `route_id`, `aircraft_id`.

### 2. Список возможностей

- [ ] Карточка направления показывает destination, distance, demand, compatible fleet, estimated weekly profit, recommendation.
- [ ] Сортировка и фильтры должны менять список предсказуемо и иметь Reset.
- [ ] Existing route отображается как состояние, а не как новая opportunity.
- [ ] На mobile сравнение остается читаемым без широкой таблицы.
- [ ] Loading не сдвигает layout; error сохраняет фильтры; empty state дает действие.

### 3. Preview и подтверждение

- [ ] Preview отвечает на четыре вопроса:
  - есть ли спрос;
  - подходит ли самолет;
  - какие ограничения;
  - какой ожидаемый финансовый результат.
- [ ] Игрок выбирает конкретный owned aircraft.
- [ ] Для рискованного маршрута показать confirmation с перечислением рисков.
- [ ] Для blocked маршрута primary CTA отсутствует; доступно «Сохранить черновик» только с объяснением.
- [ ] После создания показать success state и основной CTA «Создать расписание».

### 4. Список и карточка маршрутов

- [ ] Route card показывает pair, статус, самолет, частоту, demand, expected profit и next action.
- [ ] Route detail показывает snapshots, ограничения, историю обновления и зависимости.
- [ ] Draft можно редактировать и удалить.
- [ ] `awaiting_schedule` ведет в TODO6 с `route_id`.
- [ ] Scheduled/active route ведет к рейсам и финансовому результату.

## Продуктовые состояния

- [ ] Нет самолетов: объяснение + CTA купить самолет.
- [ ] Нет подходящих самолетов: причины + CTA открыть Fleet.
- [ ] Нет спроса: показать недостаток данных, а не нулевую «точную» оценку.
- [ ] Нет направлений после фильтров: Reset filters.
- [ ] Маршрут уже существует: открыть существующий маршрут.
- [ ] Preview устарел: автоматически обновить и попросить повторное подтверждение.
- [ ] BFF/backend недоступен: сохранить контекст, показать Retry.
- [ ] Сессия истекла: стандартный auth flow без потери выбранного направления.

## I18N, форматирование и доступность

- [ ] Удалить оставшиеся hardcoded visible strings (`Network Planner`, fallback errors и др.).
- [ ] Локализовать reason codes, statuses, recommendations, confirmations и empty/error states.
- [ ] Использовать единые форматтеры денег, пассажиров, дистанции, процентов и времени.
- [ ] Все действия доступны с клавиатуры и touch; статус не передается только цветом.
- [ ] Проверить desktop/tablet/mobile и отсутствие горизонтального overflow.

## События и аналитика

- [ ] Сохранить события `route:created`, `game:snapshot-invalidated`, `map:network-refresh-requested`.
- [ ] Добавить typed events `route:selected`, `route:updated`, `route:deleted`.
- [ ] Payload не должен содержать чувствительные или raw backend данные.
- [ ] Зафиксировать продуктовые события: opportunity viewed, preview opened, route create started/succeeded/failed, blocker encountered.

## Тесты

### BFF

- [ ] Opportunities: base, filters, sorting, pagination, degraded demand.
- [ ] Preview: compatible, runway/range block, warning, low confidence.
- [ ] Create: success, risky acknowledgement, blocked draft, duplicate, stale preview, idempotency.
- [ ] Airline isolation и запрет доверять `airline_id` клиента.
- [ ] Concurrent writes не теряют маршруты.
- [ ] PATCH revision conflict; DELETE dependency checks.
- [ ] Backend read retries и отсутствие unsafe mutation retry.
- [ ] Dashboard/map/fleet integrations.

### Frontend

- [ ] Все состояния opportunities/preview/routes.
- [ ] Фильтры, сортировка и deep links.
- [ ] Confirmation рискованного маршрута.
- [ ] Blocked route нельзя создать обычным действием.
- [ ] Success обновляет список и отправляет события.
- [ ] RU/EN parity и отсутствие прямых backend-вызовов.

### E2E/ручная приемка

- [ ] Игрок с самолетом создает первый маршрут без помощи разработчика.
- [ ] Игрок понимает, почему маршрут рекомендован, рискован или заблокирован.
- [ ] Маршрут появляется в Routes, Dashboard и Map без reload.
- [ ] CTA ведет в расписание с выбранным `route_id`.
- [ ] Сценарий проходит на desktop и mobile.

## Документация и база знаний

- [ ] Обновить `docs/bff.md` и BFF OpenAPI.
- [ ] Документировать route state machine, snapshots, idempotency и миграцию overlay.
- [ ] Добавить статьи:
  - «Как выбрать направление»;
  - «Как читать спрос и прогноз прибыли»;
  - «Почему маршрут заблокирован»;
  - «Как открыть первый маршрут».
- [ ] Добавить контекстные ссылки из opportunities, preview и route detail.

## Порядок реализации

1. Зафиксировать единые route contracts, state machine и source of truth.
2. Закрыть BFF-first аудит и retry/error/idempotency правила.
3. Укрепить storage, schema version и concurrency.
4. Унифицировать demand/economics и расширить opportunity/preview.
5. Усилить create/PATCH/DELETE validation.
6. Реализовать полноценный Opportunities UX и confirmation.
7. Реализовать route list/detail/edit/deep links.
8. Завершить Dashboard/Map/Fleet/TODO6 integrations.
9. Добавить локализацию, состояния и адаптивность.
10. Добавить тесты, OpenAPI и пользовательскую документацию.

## Definition of Done

- [ ] Все browser-запросы раздела идут только в BFF.
- [ ] Backend-чтения используют централизованные retry; опасные mutations не повторяются автоматически.
- [ ] Игрок может осознанно выбрать и создать допустимый маршрут.
- [ ] Риски, blockers, confidence и расчетная экономика объяснимы.
- [ ] Дубликаты, stale preview и повторные запросы не создают неконсистентные маршруты.
- [ ] Маршрут виден в Routes, Dashboard, Map и карточке самолета.
- [ ] Маршрут ведет к расписанию с сохраненным контекстом.
- [ ] Все состояния локализованы на `ru`/`en`, адаптивны и покрыты тестами.
