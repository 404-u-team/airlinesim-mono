# Импорт world-data

Модуль `import` в BFF строит базовые world-data для AirlineSim и отправляет их в backend API. Это ETL-пайплайн: он не прокидывает CSV в backend напрямую, а собирает несколько открытых источников, нормализует данные, синтезирует игровые поля, валидирует результат, выполняет dry-run или импорт и сохраняет отчет с сопоставлением исходных ключей с backend ID.

## Где находится код

- `index.ts` - HTTP endpoints модуля.
- `cli.ts` - CLI-вход для dry-run и импорта.
- `build/` - нормализация и синтез Country, Region, Airport, RegionLink.
  - `index.ts` - orchestration сборки dataset.
  - `countries.ts`, `regions.ts`, `airports.ts`, `regionLinks.ts`, `runways.ts` - доменные этапы сборки.
  - `shared.ts`, `types.ts` - helpers и типы, относящиеся именно к build-слою.
- `runtime/` - orchestration выполнения, storage и отчеты.
  - `pipeline.ts` - верхнеуровневый run: build, validate, reconcile, plan/import, report.
  - `importExecutor.ts` - dry-run планирование и отправка create/update запросов в backend.
  - `reconcile.ts`, `mapping.ts` - сверка с backend и idempotent source mapping.
  - `sources.ts`, `storage.ts`, `report.ts` - загрузка источников, raw cache, reports, staged dataset.
- `backend/api.ts` - backend HTTP client, retry/timeout, list/create/update requests.
- `validation/worldData.ts` - финальная валидация payload перед изменениями в backend.
- `shared/math.ts`, `shared/types.ts` - общие math helpers и типы pipeline/backend payloads.

## HTTP endpoints

Import endpoints временно не требуют пользовательский `Authorization: Bearer <token>`. Для служебных backend-действий BFF логинится под admin-учеткой из env и использует admin token. Поэтому доступ к этим endpoints нужно ограничивать окружением/инфраструктурой, пока не будет добавлена отдельная admin-авторизация на BFF.

- `POST /import/world-data`
  - По умолчанию запускает dry-run.
  - Можно передать `?mode=import`, чтобы выполнить импорт.
- `POST /import/world-data/dry-run`
  - Всегда dry-run.
- `POST /import/world-data/run`
  - Всегда импорт.
- `GET /import/world-data/status?jobId=<jobId>`
  - Возвращает статус ранее запущенной job.
- `GET /import/world-data/jobs/<jobId>`
  - То же самое, но с `jobId` в path.

`POST` endpoints не возвращают полный report. Они ставят job в in-memory очередь текущего BFF-процесса и отвечают:

```json
{
  "jobId": "uuid",
  "status": "queued",
  "statusUrl": "/import/world-data/jobs/uuid"
}
```

Статусы job:

- `queued` - запрос принят.
- `running` - pipeline выполняется.
- `succeeded` - pipeline завершился без ошибок report.
- `failed` - pipeline упал или report содержит errors.

Status endpoint возвращает краткий summary: counts, quality counters, количество warnings/errors, первые warnings/errors и путь к полному report-файлу. Полный report хранится на диске в `reports/`.

Тело запроса опциональное:

```json
{
  "source": "fetch",
  "refreshRaw": true,
  "dataDir": "data/import/world-data"
}
```

Поля:

- `source: "fetch"` - принудительно обновить raw cache из открытых источников.
- `refreshRaw: true` - то же самое, но без смены режима source.
- `dataDir` - альтернативная директория runtime storage. По умолчанию `data/import/world-data` относительно `frontend/bff`.

## CLI

Запускать из `frontend/bff`:

```bash
bun run import:world-data:dry-run
bun run import:world-data
```

Флаги:

```bash
bun src/modules/import/cli.ts --fetch
bun src/modules/import/cli.ts --refresh-raw
bun src/modules/import/cli.ts --import
```

`--fetch` и `--refresh-raw` скачивают raw-источники заново. Без этих флагов importer сначала пытается читать cached raw files.

## Env и авторизация

Нужные переменные описаны в `frontend/.env.example`:

- `BFF_PORT` - порт BFF.
- `BFF_BACKEND_BASE_URL` - base URL backend API.
- `BACKEND_ADMIN_LOGIN` или `backend_admin_login` - login backend admin user.
- `BACKEND_ADMIN_PASSWORD` или `backend_admin_password` - password backend admin user.

Dry-run может построить dataset без admin env, но не сможет сверить уже существующие backend entities через list endpoints. Import mode без admin credentials запишет ошибку в report и не будет мутировать backend.

Важно: dry-run не отправляет create/update запросы в backend. Реальная отправка выполняется только в `import` mode: `POST /import/world-data/run`, `POST /import/world-data?mode=import` или `bun run import:world-data`. В import mode сущности отправляются в backend по одной, строго в порядке Country -> Region -> Airport -> RegionLink. Если import job завершается слишком быстро, сначала проверь status endpoint: чаще всего там будет ошибка про отсутствующие backend admin credentials или backend request failure.

## Runtime storage

По умолчанию все runtime-данные лежат в:

```text
frontend/bff/data/import/world-data
```

Структура:

- `raw/` - cached raw sources: OurAirports CSV, REST Countries JSON, World Bank JSON, GeoNames TXT/ZIP.
- `manual/` - ручные overrides, отслеживаются git:
  - `countries.json`
  - `regions.json`
  - `airports.json`
  - `region-links.json`
- `stage/world-data.latest.json` - последний построенный внутренний dataset.
- `reports/` - JSON reports каждого dry-run/import.
- `mappings/source-mapping.json` - persisted mapping source entity -> backend id + payload hash.

`raw/`, `stage/`, `reports/`, `mappings/` игнорируются git, потому что это generated/runtime state. `manual/` оставлен в репозитории как стабильное место для override-файлов.

## Источники данных

Importer использует:

- OurAirports:
  - `airports.csv`
  - `runways.csv`
  - `countries.csv`
  - `regions.csv`
- REST Countries v3.1:
  - названия стран, ISO3, языки, площадь, fallback для населения, границы, признак landlocked.
- World Bank API v2:
  - population `SP.POP.TOTL`
  - GDP per capita `NY.GDP.PCAP.CD`
  - tourism arrivals `ST.INT.ARVL`
  - income level страны.
- GeoNames:
  - `cities5000.zip`
  - `admin1CodesASCII.txt`
  - распределение населения по городам и fallback для timezone.
- Manual overrides:
  - игровые значения и исправления, которые нельзя надежно получить из открытых данных.

## Порядок сущностей

Порядок импорта строгий:

1. Country
2. Region
3. Airport
4. RegionLink

Зависимости:

- Region требует backend `country_id`.
- Airport требует backend `country_id` и `region_id`.
- RegionLink требует два backend ID регионов.

`RegionLink` симметричен. Importer сортирует backend UUID регионов лексикографически перед отправкой payload, потому что в backend DB есть `CHECK (region_a < region_b)`.

## Стабильные source keys

Каждая исходная сущность получает детерминированный source key:

- Country: `country:<ISO2>`, пример `country:RU`.
- Region: `region:<LOCAL_CODE>`, пример `region:US-NY`.
- Airport: `airport:<ICAO>`, пример `airport:UUEE`.
- RegionLink: `region-link:<A>:<B>`, коды регионов отсортированы лексикографически.

Эти ключи используются в отчетах, mappings, разрешении зависимостей и идемпотентности.

## Идемпотентность и сверка с backend

Для каждого финального payload importer считает стабильный hash. Mapping entries содержат:

- `entityType`
- `sourceKey`
- `backendId`
- `payloadHash`
- `importedAt`

При повторных запусках:

- Если mapping существует и payload hash не изменился, сущность пропускается.
- Если mapping существует и payload hash изменился, importer использует OpenAPI `PUT` endpoint для этой сущности.
- Если mapping отсутствует, но admin credentials настроены, importer загружает backend state через list endpoints и сверяет естественные ключи:
  - Country по `iso`.
  - Region по `local_code`.
  - Airport по `icao_code`.
  - RegionLink через mapped backend IDs регионов.

Это предотвращает слепые повторные `POST` запросы.

## Выбор аэропортов

MVP импортирует только аэропорты, которые проходят все фильтры:

- `type` равен `large_airport`, `medium_airport` или `small_airport`.
- `scheduled_service == yes`.
- Есть валидные ICAO и IATA.
- Есть валидные latitude/longitude.
- Есть валидные `iso_country` и `iso_region`.
- Есть runway data.
- Максимальная длина ВПП не меньше `1200m`.
- Для `small_airport` максимальная длина ВПП не меньше `1500m`.

Обработка runways игнорирует закрытые полосы, невалидные длины и водные поверхности. Она рассчитывает:

- `max_runway_length_m`
- количество открытых runways
- `works_at_night` по lighted runways

## Сборка Country

Countries выбираются только если в стране есть хотя бы один выбранный airport.

Поля country payload берутся из:

- OurAirports для ISO, базового названия и wikipedia link.
- REST Countries для названий, площади, языков, границ и landlocked.
- World Bank для населения, GDP per capita, tourism и income level.
- Manual overrides для tax, tail code, permission multipliers и названий.

Игровые поля:

- `corp_tax_rate` использует manual override или fallback по income level.
- `vat_rate` использует manual override, fallback по income level, fallback по continent, затем default.
- `aircraft_tail_code` берется только из manual override. Если его нет, используется пустая строка и увеличивается quality counter.
- `flythrough_permission_price` и `land_permission_price` синтезируются из GDP, населения, площади и airport score.

## Сборка Region

Regions берутся из OurAirports regions и выбираются только если в них есть selected airports. Псевдорегионы unassigned с окончанием `-U-A` пропускаются.

Распределение населения:

- Начинается с population страны из World Bank или REST Countries.
- Если population отсутствует, используется fallback на основе airport weights.
- Когда возможно, используются airport weights и GeoNames city/admin1 population shares.

Другие поля region:

- Centroid взвешивается по selected airports.
- `business_score` объединяет regional GDP, GDP per capita, airport capacity, capital bonus, manual bonus и deterministic jitter.
- `gdp_per_capita` выводится из country GDP и business score, с deterministic jitter.
- `tourism_score` объединяет country tourism, airport capacity, manual bonus и deterministic jitter.

Manual region overrides имеют приоритет для явных значений полей.

## Сборка Airport

Финальный airport payload использует имена полей из OpenAPI:

- `country_id` и `region_id` во время build сначала содержат source keys.
- Во время import они заменяются на backend IDs из mapping.
- `geog` и `geom` - WKT points в порядке `POINT(<lon> <lat>)`.

Синтезируемые игровые поля:

- `airport_capacity_index` внутри pipeline.
- `max_runway_uses_per_day`.
- `runway_fee`, `gate_fee`, `stand_fee`.
- `turnaround_point_price`, `maintenance_point_price`.
- `fuel_price_multiplier`.
- `timezone` из manual override, ближайшего города GeoNames или fallback `UTC`.

Manual airport overrides имеют приоритет для отдельных payload fields.

## Сборка RegionLink

Importer строит разреженный граф, а не полную матрицу.

Генерация кандидатов:

- Пары внутри одной страны.
- Пары в радиусе `1500 km`.
- Top 40 ближайших регионов для каждого региона.
- Top business/tourism регионы, соединенные на расстоянии до `10000 km`.

Raw scores считаются для:

- diaspora
- business
- tourism

Затем каждый score нормализуется по dataset P95 и округляется до 2 знаков. Слабые non-domestic links отсекаются. Плотность графа ограничена максимум 50 links на регион.

Manual region-link overrides применяются после нормализации.

## Валидация

Перед dry-run/import summary финальный dataset валидируется:

- Countries: ISO2, names, диапазоны tax, диапазоны permission price, duplicate ISO.
- Regions: local code, country reference, минимумы population/GDP, диапазоны scores, duplicates.
- Airports: ICAO/IATA, names, timezone, continent, elevation, runway, fees, fuel multiplier, WKT, references, duplicates.
- RegionLinks: существующие regions, запрет self-links, запрет duplicate unordered pair, диапазоны scores.

Validation errors записываются в report. Import mode не стоит использовать, если report содержит errors.

## Отчеты

Каждый запуск пишет JSON report с:

- `startedAt`
- `finishedAt`
- `mode`
- `counts`
- `quality`
- `skipped`
- `warnings`
- `errors`

Важные quality counters:

- `countriesWithoutTailCode`
- `countriesUsingTaxFallback`
- `airportsUsingUtcFallback`
- `regionsUsingAirportPopulationFallback`

Dry-run печатает summary в stdout и не вызывает create/update endpoints. Import mode отправляет данные в backend в порядке зависимостей и сохраняет mappings. HTTP `POST` только запускает job; результат нужно смотреть через status endpoint.

## Известные допущения

- Geometry использует WKT, потому что OpenAPI описывает `geog` и `geom` как строки, а backend кастует их в PostGIS geography/geometry.
- Backend IDs извлекаются из `response.id`; в коде также есть defensive support для common nested variants.
- REST Countries field list разделен согласно требованиям v3.1 `fields`.
- ZIP extraction реализован через встроенный в Bun runtime Node `zlib`; внешняя зависимость не требуется.
