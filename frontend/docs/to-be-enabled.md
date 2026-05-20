# Admin: страницы To Be Enabled

Админ-панель живёт в `apps/shell` и доступна по `/admin`. Источник истины для включённых
CRUD-страниц - `docs/swagger.yaml` и сгенерированные типы `packages/api-contracts`.
Если сущность есть и в OpenAPI, и в ERD, приоритет у OpenAPI. Если сущность есть только в
`docs/erd.txt`, страница может существовать только как disabled-заготовка.

## Включено сейчас

| Страница | Роут | Источник | Условия работы |
| --- | --- | --- | --- |
| Countries | `/admin/countries` | OpenAPI `Country` | Нужен admin JWT; используются `GET /countries`, `POST /country`, `PUT /country/{id}`, `DELETE /country/{id}`. |
| Regions | `/admin/regions` | OpenAPI `Region` | Нужен admin JWT; используется справочник стран; CRUD через `/regions`, `/region`, `/region/{id}`. |
| Airports | `/admin/airports` | OpenAPI `Airport` | Нужен admin JWT; используются справочники стран и регионов; CRUD через `/airports`, `/airport`, `/airport/{id}`. |
| Region Links | `/admin/region-links` | OpenAPI `Region Link` | Нужен admin JWT; используется справочник регионов; CRUD через `/region-links`, `/region-link`, `/region-link/{id}`. |

## Disabled до появления OpenAPI

| Страница | Роут | Чего не хватает | Когда включать |
| --- | --- | --- | --- |
| Global Fuel Prices | `/admin/future/global-fuel-prices` | OpenAPI-схема, list/create/update/delete endpoints | После добавления `GlobalFuelPrice` schema и CRUD paths в OpenAPI. |
| Airlines | `/admin/future/airlines` | OpenAPI-схема, admin list endpoint, admin mutation endpoints | После публикации admin-схемы `Airline` и endpoints в OpenAPI. |
| Staff Configs | `/admin/future/staff-configs` | OpenAPI-схема, CRUD endpoints, контракт enum `staff_type` | После добавления `StaffConfig` schema с типизированными `staff_type`. |
| Airline To Airports | `/admin/future/airline-airports` | OpenAPI-схема, CRUD endpoints, references для airline/airport | После экспорта `AirlineToAirport` schema и справочников через OpenAPI. |
| Aircraft Manufacturers | `/admin/future/aircraft-manufacturers` | OpenAPI-схема, CRUD endpoints, upload/logo contract | После добавления `Aircraft_Manufacturer` schema и правил upload reference. |
| Aircraft Types | `/admin/future/aircraft-types` | OpenAPI-схема, CRUD endpoints, manufacturer reference | После публикации `Aircraft_Type` schema и CRUD endpoints. |
| Aircraft | `/admin/future/aircraft` | OpenAPI-схема, CRUD endpoints, references type/airline/airport | После экспорта `Aircraft` schema и reference lists. |
| Tariff Classes | `/admin/future/tariff-classes` | OpenAPI-схема, CRUD endpoints, airline reference | После добавления `TariffClass` schema и endpoints. |
| Aircraft Seats | `/admin/future/aircraft-seats` | OpenAPI-схема, CRUD endpoints, aircraft/tariff references | После экспорта `AircraftSeat` schema и references. |
| Aircraft Modifiers | `/admin/future/aircraft-modifiers` | OpenAPI-схема, CRUD endpoints, JSON effect shape | После публикации `AircraftModifier` schema с типизированными effects. |
| Aircraft Modifier Instances | `/admin/future/aircraft-modifier-instances` | OpenAPI-схема, CRUD endpoints, aircraft/modifier references | После добавления `AircraftModifierInstance` schema и endpoints. |
| Aircraft Orders | `/admin/future/aircraft-orders` | OpenAPI-схема, CRUD endpoints, configuration JSON contract | После публикации `Aircraft_Order` schema и status enum. |
| Leases | `/admin/future/leases` | OpenAPI-схема, CRUD endpoints, lease status enum | После добавления `Lease` schema и endpoints. |
| Routes | `/admin/future/routes` | OpenAPI-схема, CRUD endpoints, airport/airline references | После экспорта `Route` schema и mutation endpoints. |
| Route Tariffs | `/admin/future/route-tariffs` | OpenAPI-схема, CRUD endpoints, route/tariff references | После добавления `RouteTariff` schema и endpoints. |
| Plane Schedules | `/admin/future/plane-schedules` | OpenAPI-схема, CRUD endpoints, schedule JSON contract | После публикации `Plane_Schedule` schema с типизированным schedule payload. |
| Flights | `/admin/future/flights` | OpenAPI-схема, CRUD endpoints, flight status enum | После экспорта `Flight` schema и admin endpoints. |
| Flight Passenger Loads | `/admin/future/flight-passenger-loads` | OpenAPI-схема, CRUD endpoints, flight/tariff references | После добавления `FlightPassengerLoad` schema и endpoints. |
| Facilities | `/admin/future/facilities` | OpenAPI-схема, CRUD endpoints, facility type/status enums | После публикации `Facility` schema и typed enums. |
| Maintenance Records | `/admin/future/maintenance-records` | OpenAPI-схема, CRUD endpoints, check type/status enums | После добавления `MaintenanceRecord` schema и endpoints. |
| Loans | `/admin/future/loans` | OpenAPI-схема, CRUD endpoints, loan status enum | После экспорта `Loan` schema и endpoints. |
| Transactions | `/admin/future/transactions` | OpenAPI-схема, CRUD endpoints, transaction category contract | После публикации `Transaction` schema и type/category enums. |
| Stock Listings | `/admin/future/stock-listings` | OpenAPI-схема, CRUD endpoints, airline reference | После добавления `StockListing` schema и endpoints. |
| Shareholdings | `/admin/future/shareholdings` | OpenAPI-схема, CRUD endpoints, nullable holder rules | После публикации `Shareholding` schema с правилами holder validation. |
| Stock Trades | `/admin/future/stock-trades` | OpenAPI-схема, list endpoint, trade creation rules | После экспорта `StockTrade` schema и admin history endpoints. |
| Events | `/admin/future/events` | OpenAPI-схема, CRUD endpoints, i18n/modifier JSON contracts | После добавления `Event` schema и typed JSON contracts. |
| Event Actions | `/admin/future/event-actions` | OpenAPI-схема, CRUD endpoints, event reference | После публикации `EventAction` schema и endpoints. |
| Event Instances | `/admin/future/event-instances` | OpenAPI-схема, CRUD endpoints, status enum | После экспорта `EventInstance` schema и status contract. |
| Notifications | `/admin/future/notifications` | OpenAPI-схема, CRUD endpoints, channel/type enums | После добавления `Notification` schema и delivery enums. |
| Uploads | `/admin/future/uploads` | OpenAPI-схема, CRUD endpoints, file upload/download flow | После публикации `Uploads` schema и file lifecycle endpoints. |
