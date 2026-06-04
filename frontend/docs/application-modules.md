# Схема модулей приложения

```mermaid
flowchart TB
  User["Игрок / администратор"] --> Shell["apps/shell<br/>Router, auth, onboarding, Dashboard, navigation"]

  subgraph MFE["Module Federation remotes"]
    Map["apps/map<br/>MapLibre, аэропорты, маршруты"]
    Fleet["apps/fleet-ops<br/>Fleet market, aircraft, schedule, flights"]
    Network["apps/network-planner<br/>Opportunities, route preview, routes"]
    Finance["apps/finance-stock<br/>Overview, ledger, profitability"]
    Events["apps/events-news<br/>Events and warnings"]
    HR["apps/hr-facilities<br/>Base and facilities"]
  end

  Shell --> Map
  Shell --> Fleet
  Shell --> Network
  Shell --> Finance
  Shell --> Events
  Shell --> HR

  subgraph Shared["Shared packages"]
    UI["@airlinesim/air-ui"]
    SDK["@airlinesim/game-sdk<br/>BFF HTTP client and auth"]
    Bus["@airlinesim/event-bus"]
    Contracts["@airlinesim/api-contracts"]
    I18N["@airlinesim/i18n"]
  end

  MFE --> Shared
  Shell --> Shared
  Shared --> BFF["frontend/bff<br/>Единая browser-facing API точка"]

  subgraph BFFModules["BFF modules"]
    Auth["auth / onboarding"]
    Proxy["proxy + backend-http<br/>cache, timeout, retry, normalized errors"]
    Game["game<br/>Dashboard, map-state, events, facilities"]
    FleetBFF["fleet<br/>market, preview, purchase"]
    Demand["demand<br/>gravity passenger demand"]
    Routes["routes<br/>BFF-owned route overlay"]
    Operations["operations<br/>schedules and flights overlay"]
    FinanceBFF["finance<br/>ledger and profitability overlay"]
    Import["import<br/>world data ETL"]
  end

  BFF --> BFFModules
  BFFModules --> Backend["Неизменяемый backend API"]

  Routes --> RouteStore[("routes.json")]
  Operations --> ScheduleStore[("schedules.json / flights.json")]
  FinanceBFF --> LedgerStore[("ledger.json")]

  subgraph Sources["Открытые внешние источники импорта"]
    OA["OurAirports"]
    Geo["GeoNames"]
    Countries["REST Countries"]
    WB["World Bank"]
    OpenSky["OpenSky aircraft metadata"]
  end

  Sources --> Import
```

## Ключевые правила

- URL в Shell является источником истины для выбора MFE.
- Browser-facing приложения вызывают только BFF.
- BFF вызывает backend через `requestBackend` / `requestBackendJson`.
- Routes, schedules, flights и ledger временно принадлежат BFF до появления backend endpoints.
- Demand сохраняет среднегодовой базовый спрос в backend `RegionLink`.
- OpenSky подтверждает идентичность реальных типов ВС; игровые эксплуатационные поля остаются курируемыми.

