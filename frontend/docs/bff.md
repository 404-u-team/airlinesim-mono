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
bun --cwd bff run dev
bun --cwd bff run lint
```

Переменные окружения:

- `BFF_PORT` - порт BFF, по умолчанию `4200`.
- `BFF_BACKEND_BASE_URL` - base URL backend API, по умолчанию `http://localhost:8080`.
- `backend_admin_login` / `BACKEND_ADMIN_LOGIN` - backend admin login для служебных операций BFF.
- `backend_admin_password` / `BACKEND_ADMIN_PASSWORD` - backend admin password для служебных операций BFF.

## Авторизация

BFF проверяет токен обычного пользователя из `Authorization: Bearer ...` перед выполнением protected endpoints. Проверка идет через backend API; если backend возвращает `401` или `403`, BFF отвечает `401`.

Для служебных backend-действий BFF не использует пользовательский token. Например, `import` логинится в backend через `backend_admin_login` / `backend_admin_password`, кеширует admin access token в памяти процесса и отправляет данные в backend с этим admin token.

## Модули

### `import`

Папка: `bff/src/modules/import`.

Модуль отвечает за загрузку реальных данных мира, их очистку, нормализацию и отправку в backend. Первый endpoint:

- `POST /import/world-data`

Текущий контракт принимает массив `airports`, нормализует IATA/ICAO к uppercase, чистит пробелы и отправляет аэропорты в backend endpoint `/airport` с backend admin token.

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
