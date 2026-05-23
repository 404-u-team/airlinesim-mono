# BFF

`bff` - отдельное Bun-приложение внутри frontend-монорепозитория, но не MFE и не frontend app. Оно лежит в `frontend/bff`, потому что это backend-for-frontend слой, а не UI-приложение из `apps/*`.

## Назначение

BFF закрывает задачи, которые фронтенду неудобно или неправильно решать напрямую:

- импорт реальных данных мира, нормализация и отправка в backend;
- proxy/composition endpoints поверх backend API, когда backend-ручка есть, но ей не хватает фильтров или frontend-specific формы ответа;
- сохранение тонкого shell/remotes: UI вызывает BFF, а BFF уже договаривается с backend.

## Runtime

- Bun.
- Без runtime-библиотек по умолчанию: использовать `Bun.serve`, `fetch`, Web APIs и стандартные возможности Bun.
- Скрипты:

```bash
bun run dev
bun --cwd bff run dev
bun --cwd bff run lint
```

Корневой `bun run dev` из `frontend` запускает BFF через Turbo как задачу `@airlinesim/bff#dev` вместе с shell/remotes/packages. `bun --cwd bff run dev` нужен только для изолированного запуска BFF.

Переменные окружения:

- `BFF_PORT` - порт BFF, по умолчанию `4200`.
- `BFF_BACKEND_BASE_URL` - base URL backend API, по умолчанию `http://localhost:8080`.
- `backend_admin_login` / `BACKEND_ADMIN_LOGIN` - backend admin login для служебных операций BFF.
- `backend_admin_password` / `BACKEND_ADMIN_PASSWORD` - backend admin password для служебных операций BFF.

## Авторизация

BFF проверяет токен обычного пользователя из `Authorization: Bearer ...` перед выполнением protected endpoints. Проверка идет через backend API; если backend возвращает `401` или `403`, BFF отвечает `401`.

Для служебных backend-действий BFF не использует пользовательский token. Например, `import` логинится в backend через `backend_admin_login` / `backend_admin_password`, кеширует admin access token в памяти процесса и отправляет данные в backend с этим admin token.

Временное правило для `import`: endpoints импорта пока не требуют пользовательский `Authorization` token. Они защищены только необходимостью backend admin credentials для реального import mode. До появления отдельной admin-авторизации на BFF эти endpoints нельзя выставлять в публичный контур.

## Модули

### `import`

Папка: `bff/src/modules/import`.

Модуль отвечает за загрузку реальных данных мира, их очистку, нормализацию, синтез игровых параметров, валидацию и отправку в backend. Это ETL-пайплайн, а не прокидывание CSV в backend.

HTTP endpoints:

- `POST /import/world-data`
- `POST /import/world-data/dry-run`
- `POST /import/world-data/run`
- `GET /import/world-data/status?jobId=<jobId>`
- `GET /import/world-data/jobs/<jobId>`

`POST` endpoints запускают in-memory job и отвечают `202 Accepted` с `jobId`, `status` и `statusUrl`. Полный отчет не возвращается в стартовом ответе. Статус и краткий summary нужно получать через status endpoint; полный JSON report пишется в `bff/data/import/world-data/reports`.

CLI из `frontend/bff`:

```bash
bun run import:world-data:dry-run
bun run import:world-data
```

Флаги CLI:

- `--fetch` / `--refresh-raw` - обновить raw cache из открытых источников.

Raw/cache/stage/report/mapping данные хранятся в `bff/data/import/world-data`:

- `raw/` - скачанные CSV/JSON/TXT/ZIP источники.
- `manual/` - ручные override-файлы `countries.json`, `regions.json`, `airports.json`, `region-links.json`.
- `stage/world-data.latest.json` - последний построенный датасет.
- `reports/` - machine-readable отчеты dry-run/import.
- `mappings/source-mapping.json` - соответствие source key -> backend id + payload hash.

Порядок backend-импорта строгий:

1. Country.
2. Region.
3. Airport.
4. RegionLink.

Идемпотентность основана на стабильных source keys и hash payload. Если mapping есть и hash не изменился, запись пропускается. Если hash изменился, BFF использует `PUT` endpoint из OpenAPI. Если mapping отсутствует, BFF пытается свериться с backend list endpoints по естественным ключам (`iso`, `local_code`, `icao_code`) перед созданием.

Для служебных действий модуль логинится в backend через `backend_admin_login` / `BACKEND_ADMIN_LOGIN` и `backend_admin_password` / `BACKEND_ADMIN_PASSWORD`. Dry-run без этих переменных построит датасет и отчет, но не сможет сверить уже существующие backend сущности.

Dry-run не вызывает create/update endpoints backend. Реальный импорт выполняется только в `import` mode (`POST /import/world-data/run`, `POST /import/world-data?mode=import` или `bun run import:world-data`) и отправляет сущности по одной в порядке Country -> Region -> Airport -> RegionLink. Если job завершается быстро, смотреть причину нужно через status endpoint: например, import mode без backend admin credentials завершится ошибкой до отправки сущностей.

### `proxy`

Папка: `bff/src/modules/proxy`.

Модуль отвечает за BFF-ручки поверх backend API. Первый endpoint:

- `GET /proxy/airports`

Он вызывает backend `/airports` и применяет frontend-specific фильтры:

- `country_id`
- `iata_code`
- `icao_code`
- `q` - поиск по IATA, ICAO, международному/локальному имени и муниципалитету.

## Правила развития

- Не добавлять библиотеки без явной необходимости; Bun уже дает HTTP server, fetch, env и файловые API.
- Новые модули добавлять в `bff/src/modules/<module-name>`.
- Пользовательский `Authorization` token проверять на входе protected endpoints.
- Для backend admin-действий использовать env `backend_admin_login` / `backend_admin_password`, а не пользовательский token.
