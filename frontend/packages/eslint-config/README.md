# @airlinesim/eslint-config

Shared strict ESLint flat configs for the frontend monorepo.

Конфиги применяются ко всем существующим и целевым частям frontend-архитектуры из `../../docs/FE.png`: `Shell / Host`, `World Map`, `Fleet & Ops`, `Finance & Stock`, `Network Planner`, `Events & News`, `HR & Facilities`, `air-ui`, `event-bus`, `api-contracts`, `game-sdk`.

## Presets

- `@airlinesim/eslint-config/base` - TypeScript and JavaScript packages.
- `@airlinesim/eslint-config/vue` - Vue 3 applications and libraries.
- `@airlinesim/eslint-config/svelte` - Svelte applications and remotes.

Целевые Vue remotes используют `/vue`; `World Map` использует `/svelte`; shared TS packages используют `/base`.

## Usage

Create `eslint.config.js` in a workspace package:

```js
import config from "@airlinesim/eslint-config/vue";

export default config;
```
