# @airlinesim/air-ui

`air-ui` - дизайн-система и UI-kit фронтенда Airlinesim. Пакет содержит Vue-компоненты, Tailwind CSS theme tokens и Storybook.

Пакет обслуживает весь frontend со схемы `../../docs/FE.png`: `Shell / Host`, `World Map`, `Fleet & Ops`, `Finance & Stock`, `Network Planner`, `Events & News`, `HR & Facilities`. Даже если часть remote-приложений ещё не создана физически, новые компоненты нужно проектировать как shared UI для всех этих поверхностей.

## Команды

```bash
bun run storybook
bun run build-storybook
bun run lint
bun run lint:fix
bun run build
```

## Как добавить компонент

1. Создайте файл компонента в `src/components`, например `AirInput.vue`.
2. Используйте `<script setup lang="ts">` и явные типы props/emits.
3. Стили задавайте Tailwind-классами. Цвета берите из semantic tokens: `primary`, `surface`, `text-primary`, `success`, `warning`, `error` и т.д.
4. Не используйте локальные CSS/hex-цвета для визуального языка компонента. Если токена не хватает, сначала расширьте `src/styles/index.css`.
5. Создайте story рядом с компонентом: `AirInput.stories.ts`.
6. В story покажите все важные состояния: default, variants, sizes, disabled, invalid/loading, если применимо.
7. Экспортируйте компонент из `src/index.ts`.
8. Запустите `bun run lint` и `bun run storybook`.

## Темы

Тема задаётся CSS-переменными в `src/styles/index.css`.

- Светлая тема находится в `:root`.
- Тёмная тема находится в `:root.dark`.
- Tailwind utilities получают цвета через `@theme inline`.

Переключение темы выполняется классом `dark` на `html`:

```ts
document.documentElement.classList.toggle("dark", isDark);
```

В Storybook переключатель темы уже настроен в toolbar.

## Целевое использование

- `Shell / Host` использует `air-ui` для layout controls, navigation, auth surfaces и notification UI.
- `World Map` использует theme tokens и компактные controls поверх карты.
- `Fleet & Ops` использует buttons, forms, tables, aircraft/flight cards и operation states.
- `Finance & Stock` использует tables, charts controls, transaction states и action buttons.
- `Network Planner` использует filters, route builders, airport selectors и map-adjacent controls.
- `Events & News` использует alert, news, action-choice и notification components.
- `HR & Facilities` использует forms, staff/facility cards, progress states и management actions.

## Использование в приложении

```css
@import "@airlinesim/air-ui/styles";
```

```vue
<script setup lang="ts">
import { AirButton } from "@airlinesim/air-ui";
</script>

<template>
  <AirButton label="Action" variant="primary" />
</template>
```
