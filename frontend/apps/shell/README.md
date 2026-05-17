# Shell / Host

`apps/shell` - Vue 3 + Vite host из схемы `../../docs/FE.png`.

## Роль

- общий layout приложения;
- глобальные состояния;
- auth surfaces;
- notifications;
- i18n;
- lazy import remote-приложений через Module Federation.

## Remotes

Shell должен подключать все functional remotes со схемы:

- `World Map` - Svelte + MapLibre GL, уже реализован как `apps/map`;
- `Fleet & Ops` - Vue 3 remote для флота и операций;
- `Finance & Stock` - Vue remote для финансов и фондового рынка;
- `Network Planner` - Vue 3 remote для планирования сети;
- `Events & News` - Vue 3 remote для событий и новостей;
- `HR & Facilities` - Vue 3 remote для персонала и объектов.

## Shared Libraries

Shell использует `air-ui`, `game-sdk`, будущий `event-bus` и будущий `api-contracts`. Локальные копии UI, API-клиентов и pub/sub логики не добавлять.

## Команды

```bash
bun run dev
bun run build
bun run lint
bun run lint:fix
```
