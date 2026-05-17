# Styling

## Базовый принцип

Все существующие и целевые приложения со схемы `docs/FE.png` используют Tailwind CSS 4 через общий импорт:

```css
@import "@airlinesim/air-ui/styles";
```

Это относится к `Shell / Host`, `World Map`, `Fleet & Ops`, `Finance & Stock`, `Network Planner`, `Events & News`, `HR & Facilities` и будущим shared UI surfaces. Палитры не дублируются в приложениях. Новые цвета и семантические роли добавляются в `packages/air-ui/src/styles/index.css`, затем используются через Tailwind utilities.

## Темы

`air-ui` задаёт CSS-переменные для светлой темы на `:root` и для тёмной темы на `:root.dark`. Переключение темы выполняется добавлением/удалением класса `dark` на `html`.

Основные токены:

- `bg-background`, `bg-surface`, `bg-surface-subtle`
- `border-border`
- `text-text-primary`, `text-text-muted`
- `bg-primary`, `bg-primary-soft`, `text-on-primary`, `text-on-primary-soft`
- `bg-success`, `bg-success-bg`
- `bg-warning`, `bg-warning-bg`
- `bg-error`, `bg-error-bg`
- `bg-disabled`

## Правила компонентов

- Компоненты `air-ui` пишутся на Vue 3 + `<script setup lang="ts">`.
- Стили задаются Tailwind-классами и semantic tokens, а не локальными hex-цветами.
- Компонент должен экспортироваться из `packages/air-ui/src/index.ts`.
- Для каждого публичного компонента нужна Storybook story с основными вариантами, disabled/loading/error состояниями, если они применимы.
- Если компонент содержит интерактивные состояния, они должны быть видны в Storybook.

## Подключение в приложениях

В entry CSS приложения импортируйте:

```css
@import "@airlinesim/air-ui/styles";
```

В Vue:

```vue
<script setup lang="ts">
import { AirButton } from "@airlinesim/air-ui";
</script>

<template>
  <AirButton label="Action" variant="primary" />
</template>
```

В Svelte remotes, например `World Map`, импортируйте тот же CSS entry и используйте semantic utilities напрямую:

```svelte
<button class="bg-primary text-on-primary hover:brightness-110">
  Action
</button>
```

## Целевые Поверхности

- `Shell / Host` задаёт общий layout и тему на уровне документа.
- `World Map` использует те же токены для controls поверх карты.
- `Fleet & Ops`, `Finance & Stock`, `Network Planner`, `Events & News`, `HR & Facilities` должны использовать компоненты `air-ui` для форм, таблиц, фильтров, action controls и пустых состояний.
- `event-bus`, `api-contracts` и `game-sdk` не содержат визуальных стилей, но их документация и examples должны ссылаться на `air-ui` как единственный UI слой.
