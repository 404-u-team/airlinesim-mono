# Контракт маршрутизации MFE

Shell владеет историей браузера. Remote-приложения не должны вызывать `history.pushState`,
`history.replaceState` или создавать собственную верхнеуровневую историю `vue-router` для shell
путей. Remote может хранить локальное состояние компонентов, но каждый маршрут, видимый в
адресной строке, является shell-маршрутом.

## Источник истины

`apps/shell/src/mfe-routing.ts` — это реестр маршрутов. Он сопоставляет префикс shell-пути
с идентификатором remote и путём дочернего маршрута по умолчанию:

| Префикс | Путь по умолчанию | Remote |
| --- | --- | --- |
| `/fleet` | `/fleet/overview` | `fleet-ops` |
| `/airports` | `/airports/routes` | `network-planner` |
| `/operations` | `/operations/live-flights` | `fleet-ops` |
| `/finances` | `/finances/overview` | `finance-stock` |
| `/events` | `/events/feed` | `events-news` |
| `/staff` | `/staff/overview` | `hr-facilities` |

`/settings/system` является shell-owned route. `events-news` больше не используется как settings remote.

`/dashboard` является shell-owned route. Shell сам загружает dashboard summary и map-state из BFF, а `apps/map` монтируется внутри Dashboard как визуальный remote-виджет. Это исключение сделано потому, что Dashboard владеет глобальными CTA, прогрессом разделов, статусом компании и общей навигацией.

Навигация боковой панели, guards маршрутов и резолвинг remote должны использовать этот реестр.
Не дублируйте сопоставление prefix-to-remote в remote-приложениях.

`ShellRemoteView` всегда определяет remote по текущему `route.path`. `route.meta.remoteId` нельзя
использовать как источник истины: Vue Router переиспользует один экземпляр `ShellRemoteView` между
route-record разных MFE, и metadata предыдущего record может привести к показу старого remote после
смены URL.

## Поток навигации

1. Пользователь кликает shell `RouterLink`, либо remote отправляет `navigation:intent`.
2. Shell валидирует целевой путь через реестр.
3. Vue Router обновляет URL.
4. `ShellRemoteView` определяет активный remote и загружает его через Module Federation.
5. Shell отправляет `navigation:changed` и `navigation:remote-selected` через
   `@airlinesim/event-bus`.
6. Активный remote получает пропсы `shellPath` и `remoteId`, а также может слушать
   `navigation:changed`, когда ему нужно обновить внутреннее состояние без повторного монтирования.

## Контракт событий

Навигация от remote к shell:

```ts
airlineSimEventBus.emit("navigation:intent", {
  source: "mfe",
  targetPath: "/fleet/aircraft",
});
```

Уведомление от shell к remote:

```ts
airlineSimEventBus.on("navigation:changed", (event) => {
  // event.path: текущий shell-путь
  // event.remoteId: активный remote
  // event.navigationId: уникальный id для дедупликации и логирования
});
```

Общий `airlineSimEventBus` выполняет runtime-валидацию payload'ов для основных
событий auth, navigation, notification и готовности MFE. Некорректные payload'ы выбрасывают ошибку
до того, как пересекут границы MFE.

## Auth-маршруты

`/login` и `/register` — публичные маршруты, принадлежащие shell. Все MFE-маршруты
по умолчанию требуют аутентификации. При отсутствии аутентификации происходит редирект на `/login` с
query-параметром `redirect`; после успешного входа или регистрации пользователь возвращается на
этот путь.
