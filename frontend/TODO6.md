# TODO6: Расписание и запуск рейсов

Источник: раздел 6 `TODO_MVP.md` — «Расписание и запуск рейсов».

Разделы 1–5 считаются реализованными. У игрока есть авиакомпания, база, самолет и маршрут в статусе `awaiting_schedule`.

Backend не меняем. Расписания и экземпляры рейсов остаются BFF-owned overlay до появления backend endpoints. Все browser-facing запросы идут только в BFF; обращения BFF к backend используют общий retry/error helper.

## Результат раздела

Игрок назначает самолет на маршрут, выбирает простую частоту и время, видит проверку ограничений, активирует расписание и получает понятный список ближайших, текущих и завершенных рейсов.

Успешный финал: active schedule существует, будущие рейсы материализованы, Dashboard/Map/Events обновлены, а completed flights готовы к финансовому учету TODO7.

## Что уже реализовано

- [x] BFF-модуль `operations`.
- [x] Хранилища `schedules.json` и `flights.json` с изоляцией по airline.
- [x] Endpoints schedule options, preview, create/list schedules, list/complete flights.
- [x] Проверки route/aircraft, range, runway, maintenance, простого конфликта, night ops, oversupply и cash reserve.
- [x] Генерация рейсов на 14 дней и расчет expected financials.
- [x] Time-based статусы scheduled/boarding/in_flight/completed.
- [x] Базовый Schedule Builder и Flight Board.
- [x] Dashboard и Events читают operations overlay.
- [x] Completed flight интегрирован с finance ledger.

## Главные пробелы текущего baseline

- [ ] Проверка конфликтов сравнивает только одинаковое время и день, а не реальные интервалы block time + turnaround.
- [ ] Нет обратного рейса; текущий рейс фактически односторонний.
- [ ] Не учитываются timezone аэропортов, переход суток и локальное время прибытия.
- [ ] Не реализованы полноценные slot capacity и одновременные ограничения аэропорта.
- [ ] Нельзя редактировать, приостанавливать, возобновлять или корректно удалить расписание.
- [ ] Генерация ограничена первыми 14 днями и не поддерживает rolling horizon.
- [ ] Time-based completion меняет статус в read model, но не гарантирует запись actual/ledger без открытия Finance.
- [ ] Кнопка ручного завершения доступна обычному игроку; это должно быть dev/demo действием.
- [ ] Flight Board не показывает route/airport labels и tail number, только технические данные.
- [ ] Нет cancel/delay/issue состояний и понятного операционного действия.
- [ ] Файловые записи не защищены от конкуренции и частичного межфайлового обновления.

## Обязательные архитектурные работы

### BFF-first и retry

- [ ] Провести аудит Fleet & Ops, Dashboard, Map, Events и Finance: никаких прямых backend-запросов.
- [ ] Все product-facing операции используют `/operations/*`.
- [ ] Backend snapshot reads выполняются через `requestBackendJson` с retry для safe reads.
- [ ] BFF-owned mutations получают idempotency key и не зависят от unsafe backend retry.
- [ ] Ошибки нормализовать с `retryable`, reason codes и next action.
- [ ] Добавить автоматическую проверку запрета browser-facing backend URL.

### Надежность operations overlay

- [ ] Добавить schema version и миграции schedules/flights.
- [ ] Добавить serialized writes и защиту от lost update.
- [ ] Операции route status + schedule + generated flights выполнять как согласованную транзакцию или recoverable saga.
- [ ] Добавить reconciliation job/read repair для route/schedule/flight связей.
- [ ] Стабильные ids рейсов строить из schedule + direction + departure, а не `crypto.randomUUID`.
- [ ] Зафиксировать миграцию overlay в будущий backend.

## Полный BFF-план

### 1. Модель расписания

- [ ] Поддержать шаблоны:
  - ежедневно;
  - 3 раза в неделю;
  - раз в неделю;
  - custom days.
- [ ] Хранить локальное время вылета, timezone origin, UTC departure/arrival и validity period.
- [ ] Явно определить маршрут как round trip для MVP либо честно обозначить one-way; рекомендуемый MVP — генерировать парные outbound/return legs.
- [ ] Для return leg учитывать turnaround и доступность самолета.
- [ ] Добавить статусы schedule: `draft`, `active`, `paused`, `ended`.
- [ ] Route state синхронизировать со schedule state.

### 2. Schedule options и preview

- [ ] `GET /operations/schedule-options` возвращает только принадлежащие airline routes и aircraft.
- [ ] Поддержать `route_id` из query/deep link.
- [ ] Возвращать рекомендуемый самолет и рекомендуемую частоту.
- [ ] `POST /operations/schedule-preview` возвращает:
  - blockers/warnings;
  - sample outbound/return flights;
  - UTC и local times;
  - weekly utilization;
  - offered seats против спроса;
  - expected weekly revenue/cost/profit;
  - cash after first week;
  - affected existing schedules.
- [ ] Preview имеет revision/snapshot version и повторно проверяется при активации.

### 3. Полные проверки ограничений

- [ ] Принадлежность route/aircraft текущей airline.
- [ ] Статус route допускает расписание.
- [ ] Самолет исправен, in service и не назначен несовместимым образом.
- [ ] Дальность с согласованным operational reserve.
- [ ] ВПП origin/destination.
- [ ] Реальное пересечение интервалов: departure, block time, turnaround, return leg.
- [ ] Night operations для локального времени вылета и прибытия.
- [ ] Slot capacity по аэропорту, дню и временному окну.
- [ ] Weekly utilization не превышает согласованный предел.
- [ ] Offered seats не превышают спрос без предупреждения.
- [ ] Денежный резерв выдерживает первую неделю.
- [ ] Missing critical data не трактуется как успешная проверка.

### 4. Создание и жизненный цикл schedule

- [ ] `POST /operations/schedules` идемпотентен.
- [ ] Risky activation требует acknowledged warning codes.
- [ ] Blocked preview нельзя активировать.
- [ ] Реализовать `GET /operations/schedules/:id`.
- [ ] Реализовать `PATCH /operations/schedules/:id`:
  - изменение будущего pattern;
  - pause/resume;
  - изменение самолета;
  - effective-from date;
  - revision check.
- [ ] При изменении отменять/перегенерировать только будущие рейсы; completed immutable.
- [ ] При pause отменять или помечать future flights согласованным статусом.
- [ ] Запретить удаление расписания с историей; разрешить завершение.

### 5. Rolling flight generation и progression

- [ ] Поддерживать rolling horizon минимум 14 дней вперед при чтении/активации/reconciliation.
- [ ] Генерация идемпотентна и не создает дубли.
- [ ] Статусы должны материализоваться, а не только вычисляться в ответе.
- [ ] При переходе в completed один раз фиксировать deterministic actual и проводить TODO7 ledger.
- [ ] Добавить internal reconciliation endpoint/job для обновления статусов и ledger.
- [ ] Ручное `complete` ограничить dev/demo env и скрыть в production UI.
- [ ] Actual passengers/financials после completion immutable.

### 6. Flight read model

- [ ] `GET /operations/flights` поддерживает status, route, aircraft, date range, cursor/limit.
- [ ] Возвращать enriched labels: airports, route, aircraft tail/model, schedule.
- [ ] Разделять expected и actual.
- [ ] Возвращать issue/action codes.
- [ ] Добавить `GET /operations/flights/:id`.
- [ ] Добавить cancel только если продуктово требуется MVP; отмена должна отражаться в finance/events.

## Полный UX-план

### Schedule Builder

- [ ] Deep link с `route_id` автоматически выбирает нужный маршрут.
- [ ] Route selector показывает pair, demand, status и recommendation.
- [ ] Aircraft selector показывает tail/model, availability, utilization и причины блокировки.
- [ ] Частота задается segmented control + custom days с локализованными названиями дней.
- [ ] Время — корректный time control; turnaround — stepper/select с допустимым диапазоном.
- [ ] Preview обновляется debounced, имеет loading/error/stale states.
- [ ] В preview показывать первый полный round trip и недельную сводку.
- [ ] Перед активацией показать confirmation с предупреждениями и последствиями.
- [ ] Success ведет на Flight Board и сохраняет контекст.

### Flight Board

- [ ] Режимы: Live, Upcoming, Completed, Issues/Cancelled.
- [ ] Flight card показывает номер, pair, tail/model, local departure/arrival, статус, load и expected/actual result.
- [ ] Для completed показывать actual; для future — expected.
- [ ] Route/aircraft/flight открываются по клику через typed navigation events.
- [ ] Фильтры по route, aircraft, status и date.
- [ ] Empty state различает отсутствие route, schedule и flights.
- [ ] Обычный игрок не видит кнопку «Завершить рейс» в production.

## Интеграции

- [ ] Dashboard next action меняется `CREATE_SCHEDULE` → `VIEW_LIVE_FLIGHTS`.
- [ ] Dashboard counts используют материализованные актуальные статусы.
- [ ] Map отображает active routes и при необходимости выбранный рейс.
- [ ] Fleet aircraft detail показывает schedule/utilization/next flight.
- [ ] Events получает schedule activated, flight started/completed/cancelled и blockers.
- [ ] Finance получает completed flight ровно один раз.
- [ ] Изменение/пауза schedule обновляет route, Dashboard, Events и Finance forecast.

## Продуктовые состояния

- [ ] Нет routes: CTA в Network Planner.
- [ ] Нет совместимого самолета: причины + CTA Fleet.
- [ ] Конфликт самолета: показать конфликтующий рейс/расписание.
- [ ] Ночные ограничения: предложить допустимое время.
- [ ] Oversupply: предложить меньшую частоту/самолет.
- [ ] Низкий баланс: показать оценку и CTA Finance.
- [ ] Stale preview: пересчитать перед активацией.
- [ ] BFF/backend недоступен: Retry без потери формы.
- [ ] Истекшая сессия: auth flow с восстановлением draft формы.

## I18N, UX и доступность

- [ ] Удалить hardcoded `Route`, `Aircraft`, `Utilization`, `Live`, `Upcoming`, `Completed`, `blocked`, номера дней.
- [ ] Локализовать статусы, blockers, warnings, units, days и error states.
- [ ] Показать timezone и различие local/UTC там, где оно важно.
- [ ] Использовать единые formatters денег, дат, времени, процентов и длительности.
- [ ] Проверить keyboard/touch, focus, длинные labels, desktop/tablet/mobile.

## Тесты

### BFF

- [ ] Options только для текущей airline.
- [ ] Preview daily/custom/round trip.
- [ ] Range/runway/night/slots/cash/oversupply blockers и warnings.
- [ ] Реальное interval overlap, включая return leg и переход суток.
- [ ] Create idempotency и stale preview.
- [ ] Pause/resume/edit с корректной регенерацией future flights.
- [ ] Rolling generation без дублей.
- [ ] Time progression один раз фиксирует actual и ledger.
- [ ] Airline isolation, concurrent writes, recovery.
- [ ] Safe backend retries и отсутствие unsafe mutation retry.

### Frontend

- [ ] Deep link route selection.
- [ ] Frequency/custom days/time controls.
- [ ] Preview loading/error/blocker/warning/success.
- [ ] Activation confirmation и success navigation.
- [ ] Flight Board groups, filters, expected/actual.
- [ ] Production скрывает manual complete.
- [ ] RU/EN parity и responsive layout.

### E2E/ручная приемка

- [ ] Из route detail открыть Schedule Builder.
- [ ] Выбрать самолет и допустимое расписание.
- [ ] Увидеть понятные ограничения и недельную экономику.
- [ ] Активировать schedule один раз без дублей.
- [ ] Увидеть будущие рейсы, затем completed результат.
- [ ] Dashboard, Fleet, Map, Events и Finance согласованы.

## Документация и база знаний

- [ ] Обновить `docs/bff.md`, OpenAPI и state machine.
- [ ] Документировать timezone policy, rolling generation, idempotency и completion reconciliation.
- [ ] Добавить статьи:
  - «Как создать расписание»;
  - «Как выбрать частоту и время»;
  - «Почему самолет занят»;
  - «Как читать статусы рейсов».
- [ ] Добавить контекстные ссылки из Schedule Builder и Flight Board.

## Порядок реализации

1. Зафиксировать schedule/flight state machines и round-trip правило.
2. Закрыть BFF-first/retry/idempotency и укрепить storage.
3. Реализовать точные interval/timezone/slot проверки.
4. Расширить preview и activation validation.
5. Реализовать edit/pause/resume и rolling generation.
6. Реализовать надежное progression/completion/ledger reconciliation.
7. Завершить Schedule Builder и Flight Board UX.
8. Подключить Dashboard/Map/Fleet/Events/Finance.
9. Завершить i18n, responsive и accessibility.
10. Добавить тесты и документацию.

## Definition of Done

- [ ] Игрок активирует допустимое расписание и понимает все ограничения.
- [ ] Самолет не может одновременно находиться в двух рейсах.
- [ ] Время, turnaround, return leg и ограничения аэропортов согласованы.
- [ ] Рейсы генерируются и продлеваются без дублей.
- [ ] Completion и финансовые проводки происходят ровно один раз.
- [ ] Все browser-запросы идут через BFF; backend reads используют retry.
- [ ] Schedule/Flight state согласован с Route, Dashboard, Fleet, Events и Finance.
- [ ] Полный сценарий локализован, адаптивен и покрыт тестами.
