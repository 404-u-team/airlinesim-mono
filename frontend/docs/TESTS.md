# Тесты frontend

## Запуск

- Из `frontend` запускать все тесты командой `bun run test`.
- Для отдельного workspace использовать `bun --cwd <module-path> run test`, например `bun --cwd packages/event-bus run test`.
- Глобальный запуск работает через Turborepo и вызывает `test`-скрипт каждого модуля.

## Где хранить тесты

- Тесты каждого модуля лежат в директории `tests/` внутри этого модуля.
- Имена файлов должны соответствовать шаблону `*.test.ts`.
- Если модуль пока не имеет поведения, требующего проверки, в нем должен быть smoke-тест `tests/TEST.test.ts` с тестом `TEST`, который всегда успешно завершается.

## Требования к новым тестам

- Использовать Bun test runner: `import { expect, test } from "bun:test"`.
- Для shared-пакетов сначала покрывать чистые функции, валидаторы, контракты и API без браузерного окружения.
- Тесты должны быть детерминированными: без реальной сети, таймеров и зависимости от порядка запуска.
- Названия тестов должны описывать проверяемое поведение. Исключение - обязательный placeholder `TEST`.
- Новые модули обязаны иметь `test`-скрипт в `package.json`, чтобы `bun run test` из корня `frontend` запускал их через Turbo.
- Для admin endpoints обязательно проверять отдельно `401 AUTH_REQUIRED`, `403 ADMIN_ACCESS_REQUIRED` и успешный capability flow.
- Для BFF-owned overlays проверять dedupe, изоляцию по `airline_id`, lifecycle и отсутствие дубликатов после повторного reconcile.
- Для airport constraints проверять runway/range margin, timezone/night window и slot thresholds `80%`/`100%`/`>100%`.
