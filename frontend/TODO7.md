# TODO7: Деньги и результат операций

Источник: раздел 7 `TODO_MVP.md` - "Деньги и результат операций".

Исходное допущение пользователя: разделы 1-6 уже реализованы. Значит у игрока есть авиакомпания, база, самолет, маршрут, активное расписание и сгенерированные рейсы.

Backend не меняем. Так как backend transaction/flight financial endpoints отсутствуют, финансовый результат рейсов и ledger реализуем как BFF-owned overlay. При этом backend остается источником истины для airline baseline balance, fleet ownership и aircraft purchase effects.

## Цель раздела

Игрок должен увидеть, как действия меняют деньги: покупка самолета уже отражается backend balance, а запуск/завершение рейсов должен отражаться в BFF MVP ledger, финансовом обзоре, событиях и Dashboard.

MVP этого раздела заканчивается тем, что игрок видит баланс, прибыль/убыток рейсов, журнал операций, риски и понятные действия.

## Продуктовый Definition of Done

- [ ] Finance overview показывает последствия покупки самолета и рейсов.
- [ ] После завершения рейса появляется revenue/cost/profit.
- [ ] Игрок видит журнал операций.
- [ ] Баланс объясним: baseline backend balance + BFF ledger delta.
- [ ] Риск-сигналы ведут к действиям.
- [ ] Stock market не мешает MVP и может быть hidden/disabled.
- [ ] Dashboard, Events и Operations используют одинаковые financial values.

## Финансовая модель MVP

### 1. Источники данных

- Backend:
  - `/airline/me` - baseline balance, ratings, bankruptcy flags;
  - `/aircrafts` - owned aircraft;
  - `/aircraft-types` - fleet value, fuel/maintenance parameters;
  - `/airports` - fees and operating costs.

- BFF-owned:
  - routes from TODO5;
  - schedules/flights from TODO6;
  - ledger transactions from TODO7.

- Derived:
  - MVP available balance = backend airline balance + sum(BFF ledger amounts after baseline).

### 2. BFF ledger storage

- [ ] Добавить BFF module `bff/src/modules/finance`.

  Предлагаемые файлы:
  - `index.ts` - HTTP router;
  - `types.ts` - finance/ledger contracts;
  - `storage.ts` - ledger persistence;
  - `snapshot.ts` - backend + BFF state load;
  - `calculator.ts` - revenue/cost/profit;
  - `risk.ts` - risk signals;
  - `reconciliation.ts` - baseline balance and duplicate prevention;
  - `errors.ts`.

- [ ] Добавить persistence в `bff/data/game-state/ledger.json`.

  Минимальный transaction:

  ```ts
  type LedgerTransaction = {
    id: string;
    airline_id: string;
    source_type:
      | "aircraft_purchase"
      | "flight_revenue"
      | "flight_cost"
      | "maintenance_reserve"
      | "airport_fee"
      | "fuel_cost"
      | "adjustment";
    source_id?: string;
    flight_id?: string;
    route_id?: string;
    schedule_id?: string;
    amount: number;
    currency: "USD";
    direction: "credit" | "debit";
    category: "revenue" | "fleet" | "operations" | "maintenance" | "airport" | "fuel" | "system";
    label_code: string;
    description?: string;
    occurred_at: string;
    created_at: string;
    idempotency_key: string;
  };
  ```

- [ ] Не дублировать backend aircraft purchase.

  Если backend уже списывает стоимость самолета, BFF ledger не должен второй раз вычитать aircraft purchase из MVP balance. Можно показывать покупку в журнале как imported/backend event с amount `0` или separate display-only event, но не учитывать в overlay delta.

- [ ] Idempotency обязательна.

  Для flight completion ledger:
  - `flight:<flight_id>:revenue`;
  - `flight:<flight_id>:fuel`;
  - `flight:<flight_id>:airport`;
  - `flight:<flight_id>:maintenance`.

  Повторное completion не создает повторные транзакции.

### 3. BFF endpoints

- [ ] `GET /finance/overview`

  Заменяет/расширяет текущий `/game/finance-overview` для finance-stock.

  Ответ:
  - backend baseline balance;
  - BFF ledger delta;
  - MVP available balance;
  - fleet value;
  - daily/weekly operating reserve;
  - revenue today/week;
  - costs today/week;
  - profit today/week;
  - completed flights count;
  - risk signals;
  - next actions.

- [ ] `GET /finance/ledger`

  Query:
  - `from`;
  - `to`;
  - `category`;
  - `route_id`;
  - `flight_id`;
  - `limit`;
  - `cursor`.

  Ответ:
  - transactions;
  - totals by category;
  - balance_before/after if feasible;
  - pagination.

- [ ] `GET /finance/routes`

  Profitability by route:
  - route;
  - flights completed;
  - revenue;
  - cost;
  - profit;
  - load factor;
  - recommendation.

- [ ] `GET /finance/flights/:id`

  Детальный financial breakdown рейса:
  - passengers;
  - fare;
  - revenue;
  - fuel;
  - airport fees;
  - maintenance reserve;
  - profit.

- [ ] `POST /finance/recalculate`

  MVP/admin-safe endpoint для пересчета ledger из completed flights без дубликатов. Нужен для восстановления после изменения formulas. Можно ограничить dev/admin token later; для MVP protected user endpoint пересчитывает только свою airline.

### 4. Flight completion -> ledger

- [ ] Интегрировать TODO6 completion с finance ledger.

  Когда flight становится `completed`, BFF должен:
  - зафиксировать actual passengers/load factor;
  - посчитать revenue;
  - посчитать costs;
  - записать ledger transactions idempotently;
  - обновить flight.actual;
  - emit/return finance invalidation metadata.

- [ ] Разделить revenue и costs.

  Минимум:
  - `flight_revenue` credit;
  - `fuel_cost` debit;
  - `airport_fee` debit;
  - `maintenance_reserve` debit.

- [ ] Формула passengers/load factor.

  Для MVP:
  - base demand from route snapshot;
  - weekly frequency;
  - aircraft seats;
  - deterministic variance by flight id/date;
  - clamp to 0..seats.

  Важно: результат должен быть deterministic, чтобы refresh не менял выполненный рейс.

- [ ] Формула revenue.

  MVP:
  - fare per passenger from route economics snapshot;
  - passengers * fare;
  - optional reputation multiplier.

- [ ] Формула costs.

  MVP:
  - fuel cost = distance * aircraft fuel parameter fallback;
  - airport fees = origin/destination runway/gate/stand/turnaround fees;
  - maintenance reserve = flight hours * aircraft type maintenance cost;
  - optional fixed crew/ground service placeholder, если нужны реалистичные расходы.

- [ ] Profit classification.

  По completed flight:
  - profitable;
  - near break-even;
  - loss-making.

  Использовать для Events/Risk.

## Frontend: Finance & Stock

### 1. Разделить finance app на MVP views

- [ ] `apps/finance-stock/src/RemoteApp.vue` сейчас один обзор с hardcoded EN.

  Разбить:
  - `api.ts`;
  - `types.ts`;
  - `i18n/en.ts`, `i18n/ru.ts`;
  - `components/FinanceOverview.vue`;
  - `components/LedgerTable.vue`;
  - `components/RouteProfitability.vue`;
  - `components/RiskSignals.vue`;
  - `components/StockMarketPlaceholder.vue`.

- [ ] Route-aware rendering по `shellPath`.

  - `/finances/overview` - overview + risk + recent ledger;
  - `/finances/profit` - route/flight profitability;
  - `/finances/costs` - cost breakdown;
  - `/finances/loans-leasing` - MVP disabled unless needed;
  - `/finances/stock-market` - hidden/disabled placeholder.

### 2. Finance overview

- [ ] Показывать понятный баланс.

  Metrics:
  - available balance;
  - backend baseline balance;
  - operations delta;
  - fleet value;
  - revenue today/week;
  - costs today/week;
  - profit today/week;
  - completed flights.

- [ ] Объяснить баланс.

  UI copy:
  - "Баланс backend после покупок";
  - "Результат операций MVP";
  - "Доступный баланс в симуляции".

  Не показывать это как техническую проблему; объяснить как текущую MVP-модель, если нужно.

- [ ] Recent ledger.

  Последние 10-20 операций:
  - дата;
  - категория;
  - описание;
  - route/flight link;
  - credit/debit;
  - running balance optional.

- [ ] Risk signals.

  Минимум:
  - low balance;
  - weekly operating loss;
  - negative route profitability;
  - high maintenance reserve;
  - low load factor;
  - bankruptcy flag from backend.

  Каждый сигнал должен иметь CTA:
  - open route;
  - reduce schedule;
  - open fleet;
  - open finance costs.

### 3. Profitability views

- [ ] Route profitability.

  Для каждого route:
  - flights completed;
  - avg load factor;
  - revenue;
  - cost;
  - profit;
  - trend/status;
  - CTA to schedule or route detail.

- [ ] Costs breakdown.

  Категории:
  - fuel;
  - airport fees;
  - maintenance;
  - fleet;
  - other/system.

- [ ] Flight financial detail.

  Из flight board можно открыть breakdown в finance или inline drawer.

### 4. Stock market не блокирует MVP

- [ ] Скрыть или явно disabled stock market.

  Варианты:
  - оставить nav item, но показывать "Будет позже";
  - скрыть для обычного MVP;
  - оставить read-only placeholder с explanation.

- [ ] Не давать CTA, который уводит от первого операционного цикла.

  Если раздел остается видимым, он должен говорить: "Сначала запустите рейсы и получите операционную историю".

## Dashboard, Operations, Events integration

- [ ] Dashboard summary.

  Добавить:
  - operations profit today/week;
  - completed flights today;
  - low balance risk from finance module;
  - next action after first completed flight: view finance overview.

- [ ] Operations flight board.

  Flight rows должны показывать actual financials for completed flights and expected for upcoming.

- [ ] Events.

  Добавить события:
  - flight completed profitable;
  - flight completed loss-making;
  - low balance warning;
  - route losing money;
  - first revenue earned.

- [ ] Event bus.

  События:
  - `finance:ledger-updated`;
  - `finance:risk-created`;
  - `flight:financials-posted`;
  - `game:snapshot-invalidated`.

## I18N и тексты

- [ ] Все finance строки на `ru` и `en`.

  Категории:
  - metrics;
  - ledger categories;
  - transaction labels;
  - risk codes;
  - empty states;
  - disabled stock market;
  - MVP balance explanation.

- [ ] Форматирование.

  Использовать locale-aware:
  - currency USD;
  - percentages;
  - dates/times;
  - signed money values.

- [ ] Не показывать raw backend/BFF terms.

  Запрещено в UI:
  - `ledger_delta`;
  - `source_type`;
  - `baseline`;
  - raw id без label.

## BFF consistency rules

- [ ] Единый finance calculator.

  Route preview (TODO5), schedule preview (TODO6), flight completion (TODO7), finance overview должны использовать совместимые формулы. Нельзя, чтобы route preview обещал прибыль, а completed flight считал по другой логике без объяснения.

- [ ] Immutable completed flight financials.

  После completion actual financials не меняются при refresh. Если формула меняется, нужен explicit recalculation endpoint.

- [ ] No double counting.

  Проверить:
  - aircraft purchase backend balance не дублируется ledger overlay;
  - completed flight revenue не записывается дважды;
  - recalculation idempotent.

- [ ] Time windows.

  Все totals today/week должны использовать единый timezone policy. Для MVP можно UTC, но UI должен форматировать понятно.

## Тесты

### BFF tests

- [ ] ledger write/read by airline id.
- [ ] completed flight creates revenue and cost transactions.
- [ ] repeated completion does not duplicate ledger.
- [ ] finance overview combines backend balance + ledger delta.
- [ ] route profitability aggregates completed flights.
- [ ] risk signals low balance/loss-making route.
- [ ] stock market endpoint/view disabled if no backend support.
- [ ] recalculate endpoint idempotent.

### Frontend tests

- [ ] finance overview renders all metrics.
- [ ] ledger renders credits/debits and empty state.
- [ ] risk signals show CTA.
- [ ] route profitability table/cards render.
- [ ] stock market placeholder does not look broken.
- [ ] locale formatting in ru/en.

### Manual QA

- [ ] Запустить schedule из TODO6.
- [ ] Дождаться/завершить рейс.
- [ ] Открыть `/finances/overview`.
- [ ] Увидеть revenue/cost/profit.
- [ ] Открыть ledger и увидеть операции рейса.
- [ ] Dashboard показывает измененный финансовый результат.
- [ ] Events показывают результат рейса.

## Документация

- [ ] Обновить `docs/bff.md`: BFF-owned finance ledger overlay.
- [ ] Обновить BFF OpenAPI overlay для `/finance/*`.
- [ ] Обновить будущую базу знаний:
  - "Как понять прибыльность рейса";
  - "Почему меняется баланс";
  - "Что делать при финансовых предупреждениях".
- [ ] Явно задокументировать, что stock market вне MVP.

## Порядок реализации

1. Добавить finance storage и ledger contracts.
2. Реализовать finance calculator shared with operations.
3. Интегрировать flight completion -> ledger.
4. Реализовать `/finance/overview`.
5. Реализовать `/finance/ledger`.
6. Реализовать route/flight profitability endpoints.
7. Обновить Dashboard/Events/Operations integrations.
8. Разбить finance-stock на views/components/i18n.
9. Реализовать overview, ledger, profitability, disabled stock.
10. Добавить тесты.
11. Обновить docs/OpenAPI.

## Definition of Done для TODO7

- [ ] Finance работает через BFF-owned ledger без backend changes.
- [ ] Completed flights создают idempotent financial transactions.
- [ ] Баланс и операции объяснимы пользователю.
- [ ] Finance overview, ledger и route profitability работают.
- [ ] Risk signals ведут к действиям.
- [ ] Stock market не блокирует MVP.
- [ ] Dashboard/Operations/Events используют те же financial values.
- [ ] Все тексты локализованы на `ru` и `en`.
- [ ] Есть BFF/frontend тесты.
