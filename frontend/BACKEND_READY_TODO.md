# Backend-ready TODO

Короткий список frontend-задач, которые уже можно делать поверх текущих backend routes/OpenAPI.

## Реализовано в этом проходе

- `GET /demand/airport-pair` в BFF: ленивый расчет спроса по паре аэропортов и сохранение в `RegionLink.base_daily_demand_ab/ba`.
- `apps/fleet-ops`: покупка самолета через `POST /aircraft`, каталог `GET /aircraft-types`, список своих бортов `GET /aircrafts`, выбор базового аэропорта через `GET /airports`.
- `apps/finance-stock`: finance overview через BFF `GET /game/finance-overview`.
- `apps/network-planner`: route opportunities через `GET /game/network-opportunities` и расчет спроса через `GET /demand/airport-pair`.
- `apps/events-news`: operations feed через BFF `GET /game/events-feed`.
- `apps/hr-facilities`: base facilities overview через BFF `GET /game/facilities-overview`.
- `packages/air-ui`: общий `AirMetricCard` для KPI карточек в MFE.

## Готово на backend и еще стоит подключить на frontend

- Карточка самолета: `GET /aircraft/{id}` уже отдает состояние борта, базу, maintenance points, часы и циклы.
- Редактирование tail number: `PATCH /aircraft/{id}` с `{ "tail_number": "..." }`.
- Профиль авиакомпании: `GET /airline/me`, `PATCH /airline/{id}` для имени, IATA и ICAO.
- Публичное получение авиакомпании по id: `GET /airline/{id}`.
- Admin CRUD для справочников world data: countries, regions, region-links, airports уже есть и частично включен в Shell admin.
- Admin создание aircraft types: `POST /aircraft-types` готово, но на фронте пока нет полноценной формы с manufacturer/upload UX.

## Backend gaps, которые мешают следующим крупным фичам

- Region/country/airport list endpoints в gateway сейчас находятся внутри admin-only group. BFF обходит это admin-token для demand/cache, но обычный frontend UX лучше перевести на read-only protected/public backend routes.
- Для `aircraft_manufacturer` нет опубликованных list/create endpoints, хотя `aircraft_type.manufacturer_id` уже есть.
- Нет route/flight endpoints для превращения рассчитанного спроса в расписание, частоты, цены и продажи.
- Нет отдельного endpoint для balance preview перед покупкой самолета; покупка списывает деньги сразу.
