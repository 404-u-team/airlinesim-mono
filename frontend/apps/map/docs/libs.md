1. @turf/turf - geo-tookit - https://turfjs.org/docs
2. maplibre-gl - https://maplibre.org/maplibre-gl-js/docs/

## Shared Libraries From FE.png

- `air-ui` - общий UI-kit, Tailwind CSS tokens и icons для `World Map` и всех Vue remotes.
- `game-sdk` - общий API wrapper для backend REST API.
- `event-bus` - целевой shared package для cross-MFE pub/sub.
- `api-contracts` - целевой shared package для OpenAPI -> TS types и Zod-схем.

`World Map` находится в одном MFE слое с `Fleet & Ops`, `Finance & Stock`, `Network Planner`, `Events & News`, `HR & Facilities`; новые map-интеграции должны проектироваться с учётом этих соседних remotes.
