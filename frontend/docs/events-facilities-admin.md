# Events, Facilities и Admin

## Источники истины

- Backend остается источником истины для identity, airline, fleet и world data.
- BFF хранит MVP overlays маршрутов, расписаний, рейсов, ledger, events и notifications.
- Event является неизменяемым историческим фактом. Notification является текущим риском с `active/resolved` и `read/unread`.
- `@airlinesim/event-bus` передает только invalidation, transient toast и navigation intent; он не хранит события.

## Airport constraints

Единый domain находится в `bff/src/modules/facilities`. Fleet, Routes, Schedule и Facilities должны использовать его helpers и общие codes.

- Runway: отсутствие данных и отрицательный margin блокируют техническую совместимость.
- Night operations: MVP night window `23:00-06:00` local. Запрещенная ночная операция блокирует schedule; отсутствующая timezone является warning.
- Slots: показывается физическая capacity и planning headroom только текущей airline. `80-100%` является warning, `>100%` blocker.
- Одна представленная операция departure/arrival использует одну единицу runway capacity. Нельзя считать скрытый return flight.

## Events и notifications

Runtime JSON хранится в `bff/data/game-state` и игнорируется Git. Запись атомарна через temporary file + rename.

- Events дедуплицируются по `(airline_id, dedupe_key)` и после записи не переписываются.
- Notifications сверяются детерминированно: существующий active risk обновляет параметры, исчезнувший risk становится resolved.
- Read state сохраняется при обычной сверке active risk.
- Browser не передает trusted `airline_id`; BFF получает его из `/airline/me`.

## Admin boundary

- UI visibility не является защитой.
- Все `/admin/world/*` и `/admin/import/*` требуют capability `world.manage`.
- Текущий переходный capability source — probe документированного admin-only backend read endpoint. Его нужно заменить явным backend identity/capabilities contract.
- Service admin credentials разрешены только внутри import pipeline и никогда не возвращаются browser.
- World CRUD идет через namespaced BFF endpoints, после mutation очищается list cache.
- `/admin/world/readiness` проверяет, может ли новый игрок пройти первый игровой цикл.
- World mutations и завершение import jobs записываются в ограниченный BFF audit trail (`GET /admin/audit`) без токенов и service credentials.
- Import job status хранится в памяти процесса и после restart недоступен; итоговый report и audit entry сохраняются.

## Проверки

После изменений запускать из `frontend`:

```bash
bun run lint
bun run test
```
