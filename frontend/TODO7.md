# TODO7: Деньги и результат операций

Источник: раздел 7 `TODO_MVP.md` — «Деньги и результат операций».

Разделы 1–6 считаются реализованными. У игрока есть авиакомпания, самолет, маршрут, активное расписание и рейсы.

Backend не меняем. Backend balance остается базовой суммой после поддержанных backend-действий, а результат BFF-owned рейсов учитывается в BFF ledger. Все browser-facing запросы идут только в BFF; BFF обращается к backend через централизованный helper с retry для безопасных чтений.

## Результат раздела

Игрок должен доверять финансовой модели и понимать:

- сколько денег доступно;
- что изменило баланс;
- сколько заработали и потратили рейсы;
- какие маршруты прибыльны;
- какие риски требуют действия.

Успешный финал: completed flight один раз создает объяснимые проводки, Finance/Dashboard/Operations/Events показывают согласованные значения, а риск ведет к конкретному действию.

## Что уже реализовано

- [x] BFF-модуль `finance`.
- [x] Ledger в `bff/data/game-state/ledger.json`.
- [x] Idempotency keys для проводок completed flight.
- [x] Endpoints:
  - `GET /finance/overview`;
  - `GET /finance/ledger`;
  - `GET /finance/routes`;
  - `GET /finance/flights/:id`;
  - `POST /finance/recalculate`.
- [x] Available balance = backend baseline + BFF operations delta.
- [x] Flight revenue, fuel, airport fee и maintenance reserve.
- [x] Базовые risk signals.
- [x] Finance Overview, recent ledger, route profitability и disabled stock market.
- [x] Базовая локализация `ru`/`en`.

## Главные пробелы текущего baseline

- [ ] UI показывает внутреннее понятие «Backend balance», что неприемлемо как финальный продуктовый текст.
- [ ] Cost split сейчас процентный после общей суммы, а не результат единого детального calculator.
- [ ] Route preview, schedule preview и actual flight могут использовать отличающиеся формулы.
- [ ] Автоматически завершенный по времени рейс может попасть в ledger только при последующем чтении Finance/Operations.
- [ ] Ledger pagination/filtering неполные; нет running balance и понятных linked entity labels.
- [ ] Route profitability показывает обрезанные raw airport ids.
- [ ] Нет forecast/runway и объяснения достаточности денег на ближайший период.
- [ ] Нет reconciliation baseline/version; изменение backend balance может быть ошибочно интерпретировано.
- [ ] `POST /finance/recalculate` требует более четкой защиты и версии формулы.
- [ ] Файловое хранилище не защищено от конкурентных записей.

## Обязательные архитектурные работы

### BFF-first и retry

- [ ] Провести аудит Finance, Dashboard, Operations, Events и связанных shared API.
- [ ] Удалить прямые backend-запросы и raw backend DTO из browser-facing логики.
- [ ] Все финансовые UI используют `/finance/*` или согласованные BFF read models.
- [ ] Backend balance/fleet reads выполняются через `requestBackendJson` с safe retry.
- [ ] Ledger mutations являются BFF-owned, идемпотентными и не зависят от unsafe backend retry.
- [ ] Ошибки нормализовать и локализовать; Retry показывать только для retryable.

### Единый финансовый источник истины

- [ ] Создать versioned shared finance calculator, используемый TODO5, TODO6 и TODO7.
- [ ] Разделить forecast/expected и actual; completed actual immutable.
- [ ] Каждая сумма должна иметь currency, formula version, source entity и occurred_at.
- [ ] Зафиксировать политику rounding и timezone.
- [ ] Не учитывать backend purchase второй раз в BFF ledger.
- [ ] Задокументировать reconciliation при изменении backend baseline.

### Надежность ledger

- [ ] Добавить schema version, formula version и миграции.
- [ ] Добавить serialized writes/lock и защиту от lost update.
- [ ] Сохранять пачку проводок одного рейса атомарно.
- [ ] Проверять баланс проводок рейса и idempotency до записи.
- [ ] Добавить repair/reconciliation report, не меняющий данные молча.
- [ ] Ограничить recalculate текущей airline и явным безопасным сценарием.

## Полная финансовая модель MVP

### 1. Денежные понятия

- [ ] В продукте использовать:
  - «Доступные средства»;
  - «Результат полетов»;
  - «Стоимость флота»;
  - «Доходы»;
  - «Операционные расходы»;
  - «Прибыль/убыток».
- [ ] Не показывать пользователю слова `backend`, `ledger_delta`, `baseline`, `source_type`.
- [ ] В detail/help можно объяснить, что доступные средства учитывают покупки и результат завершенных рейсов, без технической архитектуры.

### 2. Единый расчет рейса

- [ ] Actual passengers определяются детерминированно и фиксируются при completion.
- [ ] Revenue = passengers × actual fare с согласованными modifiers.
- [ ] Fuel cost рассчитывается из distance/block hours, aircraft fuel burn и единой цены топлива.
- [ ] Airport cost рассчитывается из реальных доступных сборов origin/destination.
- [ ] Maintenance reserve рассчитывается из block hours и aircraft type cost.
- [ ] Дополнительные недоступные данные либо явно остаются вне MVP, либо входят как named fixed operations cost.
- [ ] Profit = revenue − сумма детальных расходов.
- [ ] Сумма breakdown всегда совпадает с headline profit.

### 3. Forecast и actual

- [ ] TODO5 показывает route-level estimate с confidence.
- [ ] TODO6 показывает weekly schedule forecast.
- [ ] TODO7 показывает actual completed flight и агрегаты.
- [ ] Разница forecast/actual объяснима пассажирской загрузкой и зафиксированными факторами.
- [ ] Изменение формулы не переписывает historical actual без явной миграции.

## Полный BFF-план

### 1. Completion → ledger

- [ ] Reconciliation запускается при progression рейсов, а не только при открытии Finance.
- [ ] Для каждого completed flight создается одна атомарная группа:
  - revenue credit;
  - fuel debit;
  - airport fees debit;
  - maintenance reserve debit;
  - optional named operations debit.
- [ ] Group имеет `flight_id`, `route_id`, `schedule_id`, `formula_version`.
- [ ] Повторная обработка возвращает существующий результат и не создает дубли.
- [ ] Cancelled flight не создает обычную выручку; правила cancellation cost документированы.

### 2. Finance overview

- [ ] `GET /finance/overview` возвращает:
  - available cash;
  - operations result;
  - fleet value;
  - today/7d revenue, costs, profit;
  - completed flights;
  - forecast next 7 days;
  - cash runway;
  - recent transactions;
  - risks и next actions.
- [ ] Backend baseline остается внутренней диагностикой, а не обязательным UI-полем.
- [ ] Добавить `updated_at`, data freshness и degraded flags.

### 3. Ledger

- [ ] `GET /finance/ledger` поддерживает:
  - from/to;
  - category;
  - route_id;
  - flight_id;
  - direction;
  - cursor/limit.
- [ ] Возвращать linked labels для flight, route и airports.
- [ ] Возвращать running balance или balance after transaction.
- [ ] Группировать проводки рейса для понятного drill-down.
- [ ] Экспорт не обязателен для MVP; если добавляется, только через BFF и текущую airline.

### 4. Profitability

- [ ] Route profitability включает airport labels, flights, passengers, avg load, revenue, costs, profit и margin.
- [ ] Flight detail показывает полный breakdown expected vs actual.
- [ ] Cost breakdown агрегирует fuel/airport/maintenance/operations.
- [ ] Маршрут без completed flights получает `insufficient_data`, а не «нулевую прибыльность».
- [ ] Рекомендации используют минимальный объем данных и не объявляют маршрут убыточным по одному рейсу без пояснения.

### 5. Риски и действия

- [ ] Low cash: CTA в costs/расписание.
- [ ] Negative weekly result: CTA в route profitability.
- [ ] Loss-making route: CTA в route detail/schedule.
- [ ] Low load factor: CTA изменить частоту.
- [ ] High maintenance cost: CTA Fleet.
- [ ] Bankruptcy flag: отдельное понятное состояние.
- [ ] Risk содержит code, severity, explanation inputs и actionable target.

## Полный UX-план Finance & Stock

### Overview

- [ ] Первый экран показывает доступные средства, результат полетов, доходы, расходы, прибыль и стоимость флота.
- [ ] Показать период каждой метрики.
- [ ] Показать краткое объяснение изменения денег.
- [ ] Risks размещены по приоритету и ведут к действию.
- [ ] Recent operations группируются по рейсам и категориям.
- [ ] Loading/error/empty/degraded states не показывают ложные нули.

### Journal

- [ ] Отдельный понятный журнал операций.
- [ ] Фильтры по периоду, категории, маршруту и рейсу.
- [ ] Каждая строка показывает дату, понятное описание, связанный объект, доход/расход и баланс после.
- [ ] Клик открывает flight financial detail.
- [ ] На mobile журнал отображается карточками или адаптивными строками без overflow.

### Profit and costs

- [ ] `/finances/profit` показывает маршрутную прибыльность с labels, а не ids.
- [ ] `/finances/costs` показывает категории расходов и их доли.
- [ ] Route/flight drill-down объясняет формулу и expected vs actual.
- [ ] Периоды и фильтры одинаковы между overview/profit/costs.

### Stock market

- [ ] Оставить disabled в navigation до отдельного продуктового раздела.
- [ ] Если route открыт напрямую, показать локализованное future state без ложных действий.
- [ ] Stock market не влияет на Definition of Done MVP.

## Интеграции

- [ ] Dashboard использует available cash и finance risks, а не только raw airline balance.
- [ ] Operations показывает expected для future и actual для completed.
- [ ] Route detail показывает profitability после появления данных.
- [ ] Events создает first revenue, profitable/loss flight, low cash и route loss события с действиями.
- [ ] Все экраны используют один calculator/formula version.
- [ ] Invalidation events обновляют Finance после completion без reload.

## Продуктовые состояния

- [ ] Нет completed flights: объяснить, что actual появится после завершения рейса.
- [ ] Есть schedule, но нет completed: показать forecast отдельно.
- [ ] Нет маршрутов: CTA к планированию.
- [ ] Убыточный рейс/маршрут: объяснить основные cost drivers.
- [ ] Данных недостаточно: честный insufficient-data state.
- [ ] Reconciliation/degraded: сохранить последние надежные данные и предложить Retry.
- [ ] Истекшая сессия: единый auth flow.

## I18N, форматирование и доступность

- [ ] Заменить «Баланс backend» и другие технические формулировки.
- [ ] Удалить fallback raw codes/ids из UI.
- [ ] Локализовать categories, transactions, risks, periods, empty/error states.
- [ ] Использовать единые locale-aware currency, signed values, percentages, dates.
- [ ] Цвет не является единственным признаком дохода/расхода/риска.
- [ ] Проверить desktop/tablet/mobile, keyboard и screen-reader labels.

## Тесты

### BFF

- [ ] Единый calculator дает согласованные route/schedule/actual значения.
- [ ] Completed flight создает сбалансированную атомарную группу проводок.
- [ ] Повторная completion/reconcile не создает дубли.
- [ ] Concurrent reconcile безопасен.
- [ ] Backend purchase не учитывается второй раз.
- [ ] Overview корректно объединяет baseline и ledger.
- [ ] Ledger filters/pagination/running balance.
- [ ] Route/flight profitability и insufficient data.
- [ ] Risks и action targets.
- [ ] Airline isolation, migration, corrupt storage, safe retries.

### Frontend

- [ ] Overview metrics, periods, risks и empty/degraded states.
- [ ] Ledger filters, grouped flight entries и detail.
- [ ] Route profitability labels вместо ids.
- [ ] Costs breakdown.
- [ ] Disabled stock market.
- [ ] RU/EN parity и locale formatting.
- [ ] Finance обновляется после flight completion event.

### E2E/ручная приемка

- [ ] Завершить рейс из TODO6.
- [ ] Увидеть результат без ручного пересчета и reload.
- [ ] Сумма breakdown совпадает с profit и изменением доступных средств.
- [ ] Открыть маршрут и понять его прибыльность.
- [ ] Нажать risk и попасть к исправляющему действию.
- [ ] Повторное открытие/обновление не дублирует деньги.

## Документация и база знаний

- [ ] Обновить `docs/bff.md`, OpenAPI и finance source-of-truth.
- [ ] Документировать formula version, rounding, timezone, idempotency и reconciliation.
- [ ] Добавить статьи:
  - «Почему меняется баланс»;
  - «Как читать журнал операций»;
  - «Как понять прибыльность рейса и маршрута»;
  - «Что делать при финансовых предупреждениях».
- [ ] Добавить контекстные help links из Overview, Journal, Profit и Costs.

## Порядок реализации

1. Зафиксировать продуктовые денежные понятия и единый finance calculator.
2. Закрыть BFF-first/retry и укрепить ledger storage.
3. Реализовать надежный completion → actual → ledger pipeline.
4. Расширить overview, ledger, profitability и risks contracts.
5. Перевести Dashboard/Operations/Routes/Events на единые значения.
6. Переработать Finance Overview и технические тексты.
7. Реализовать Journal, Profit, Costs и drill-down.
8. Завершить i18n, responsive и accessibility.
9. Добавить тесты, OpenAPI и пользовательскую документацию.

## Definition of Done

- [ ] Все browser-facing финансовые запросы идут только через BFF.
- [ ] Safe backend reads используют retry; ledger mutations идемпотентны.
- [ ] Completed flight влияет на деньги ровно один раз.
- [ ] Доступные средства и каждая операция объяснимы игроку.
- [ ] Forecast, expected и actual различены и согласованы.
- [ ] Overview, Journal, Profit, Costs, Dashboard, Operations и Events показывают единые значения.
- [ ] Риски ведут к конкретному действию.
- [ ] В UI нет raw ids и технических терминов BFF/backend.
- [ ] Сценарий локализован, адаптивен и покрыт тестами.
