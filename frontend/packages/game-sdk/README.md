# @airlinesim/game-sdk

Клиентская библиотека для работы с backend API AirlineSim. Пакет должен быть единой точкой входа для HTTP-запросов, авторизации, realtime-подключений и будущих доменных клиентов.

## Структура

- `src/api` - базовый HTTP-клиент на Axios, нормализация ошибок и retry после `401` через refresh callback.
- `src/auth` - login/register/refresh, хранение access token, связка `apiClient + authClient`.
- `src/realtime` - создание Socket.IO клиента с тем же источником токена.
- `src/config` - чтение `VITE_BACKEND_URL` и `VITE_SOCKET_URL`.
- `src/contracts` - публичный re-export типов из `@airlinesim/api-contracts`.
- `src/errors` - общие ошибки SDK.

`src/index.ts` остается тонким фасадом и только экспортирует публичные модули.

## Использование

```ts
import { createAuthenticatedApiClient } from "@airlinesim/game-sdk";

const { apiClient, authClient } = createAuthenticatedApiClient();

await authClient.login({ login: "captain", password: "password" });
const countries = await apiClient.get("/countries");
```

Адрес backend задается через `.env`: `VITE_BACKEND_URL`. Для socket endpoint используется `VITE_SOCKET_URL`.
