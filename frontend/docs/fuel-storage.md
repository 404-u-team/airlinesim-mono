# Топливное хранилище авиакомпании

## Контекст

Раньше топливо «покупалось» неявно в момент вылета по текущей спотовой цене. Теперь авиакомпания может закупать керосин заранее, хранить его и расходовать на рейсы из запаса — это даёт смысл ловить низкие котировки.

## Источник истины

- Модуль BFF: `bff/src/modules/fuel/fuel-storage.ts`.
- Состояние хранится в SQLite-документе `fuel-storage` (по одному состоянию на airline_id): `stored_tonnes`, журнал `history`, суммарные закупки для средней цены и идемпотентный журнал `consumed_flights` (flight_id → списанный объём/спот-добор).
- Ёмкость фиксированная и глобальная: `FUEL_STORAGE_CAPACITY_TONNES = 100 000 т` (MVP).

## Сценарии

1. **Закупка**: `POST /fuel/storage/purchase { tonnes }` — проверка баланса (backend balance + ledger delta) и свободной ёмкости, списание через ledger-транзакцию `FINANCE_FUEL_PURCHASE` (category `fuel`, source_type `fuel_purchase`).
2. **Расход**: при сеттлменте вылетевшего рейса (`finance/ledger.ts → reconcileCompletedFlights`) тоннаж рейса (`expected.fuel_tonnes`, рассчитывается в `estimateFlightFinancials`) списывается из хранилища; недостающее докупается «на споте» — топливная ledger-транзакция рейса равна только стоимости спот-добора. Списание идемпотентно по flight_id.
3. **Просмотр**: `GET /fuel/storage` — снапшот: остаток, ёмкость, средняя цена закупки, текущая котировка, история изменений (purchase/consumption).

## Frontend

- Панель топлива (`apps/fleet-ops` → `FuelStoragePanel.vue`): метрики (остаток, заполнение, средняя цена, оценка запаса в днях), график остатка (`FuelStorageChart.vue`), форма закупки.
- Топбар Shell показывает **остаток топлива в тоннах** вместо цены (`getStatusMetrics`, состояние `apps/shell/src/fuel/state.ts`, обновляется при `game:snapshot-invalidated`).

## Правила для будущих агентов

- Не списывайте топливо повторно: единственная точка расхода — `consumeFuelForFlights`, журнал `consumed_flights` обязателен.
- `fuel_tonnes` в `FlightFinancials` опционален (legacy-рейсы); fallback — 55% стоимости рейса по текущей цене.
- Закупка топлива — операционный расход (показывается всегда); это НЕ capex и не входит в `excluded_from_balance`.
