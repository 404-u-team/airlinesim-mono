# World Map Remote

`apps/map` - Svelte + Rsbuild remote из схемы `../../docs/FE.png`. Приложение экспортирует карту через Module Federation и подключается в `Shell / Host`.

## Роль

- интерактивная карта мира;
- MapLibre GL стили;
- Svelte controls поверх карты;
- 2D/3D projection controls;
- будущие aircraft/route overlays.

## Место В Архитектуре

`World Map` - один из remote-модулей рядом с целевыми `Fleet & Ops`, `Finance & Stock`, `Network Planner`, `Events & News`, `HR & Facilities`. Все remotes должны использовать общие shared libraries: `air-ui`, `game-sdk`, будущий `event-bus`, будущий `api-contracts`.

## Команды

```bash
bun run dev
bun run build
bun run lint
bun run lint:fix
bun run svelte-check
```

Dev server работает на `4001`, shell ожидает manifest по `http://localhost:4001/mf-manifest.json`.
