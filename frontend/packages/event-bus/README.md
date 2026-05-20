# @airlinesim/event-bus

Типизированная singleton-шина событий для связи Shell и MFE. Пакет должен быть единственным способом передавать cross-MFE события, если сценарий не является обычной URL-навигацией.

## Структура

- `src/core` - generic in-memory event bus: `on`, `once`, `off`, `emit`, `clear`, `listenerCount`.
- `src/contracts` - контракт событий AirlineSim, типы `RemoteId`, navigation/auth payloads и runtime validators.
- `src/singleton.ts` - общий экземпляр `airlineSimEventBus` с включенной проверкой payload.
- `src/index.ts` - тонкий публичный фасад.

## Использование

```ts
import { airlineSimEventBus } from "@airlinesim/event-bus";

airlineSimEventBus.emit("navigation:intent", {
  source: "mfe",
  targetPath: "/fleet/aircraft",
});
```

Если payload не соответствует контракту, singleton бросит ошибку до передачи события слушателям. Это нужно, чтобы ошибки интеграции между MFE проявлялись сразу.
