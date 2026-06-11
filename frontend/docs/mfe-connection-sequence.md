# Последовательность навигации и загрузки MFE (Module Federation)

Эта диаграмма описывает реальный процесс навигации пользователя на роут remote-приложения (например, `/fleet`), динамического разрешения зависимости через Module Federation v2 и монтирования приложения.

```plantuml
@startuml
skinparam ParticipantPadding 10
skinparam BoxPadding 10

actor "Пользователь" as User
participant "Shell (Хост)" as Shell
participant "Vue Router (Shell)" as Router
participant "ShellRemoteView" as RemoteView
participant "Module Federation Runtime" as MF
database "mf-manifest.json (Remote)" as Manifest
participant "FleetOpsRemoteApp (Remote)" as RemoteApp
participant "airlineSimEventBus (Singleton)" as EventBus

User -> Shell : Переход на /fleet
Shell -> Router : Навигация на маршрут /fleet
Router -> RemoteView : Соответствие пути /fleet/:mfePath(.*)*
Note over RemoteView: Определяет activeRemoteId = 'fleet-ops'
RemoteView -> RemoteView : Вычисление activeVueRemote = import('fleetOps/App')

alt Первый запрос (не кэшировано)
    RemoteView -> MF : Запрос модуля fleetOps/App
    MF -> Manifest : GET /mf-manifest.json
    Manifest --> MF : Манифест модулей + чанки
    MF -> MF : Регистрация shared-зависимостей (vue, event-bus, etc.)
else Повторный запрос
    RemoteView -> MF : Запрос модуля
    MF --> RemoteView : Модуль из кэша
end

MF --> RemoteView : Разрешённый компонент App (Remote)
RemoteView -> RemoteApp : Монтирование <component :is="activeVueRemote" />
activate RemoteApp
RemoteApp -> RemoteApp : Инициализация Vue/Rsbuild remote
note over RemoteApp: Вызов useFleetController()
RemoteApp -> EventBus : emit('mfe:ready', { remoteId: 'fleet-ops' })
deactivate RemoteApp
RemoteView --> Shell : Рендеринг Fleet & Ops UI
Shell --> User : Отображение UI
@enduml
```

## Ключевые отличия от старой схемы (MFE-MF-CONNECT-EXAMPLE.png):
1. **Разрешение путей**: На хосте роуты мапятся на wildcard-путь вида `${route.pathPrefix}/:mfePath(.*)*`, которые рендерит компонент `ShellRemoteView.vue`. Динамический импорт идет по пути `"fleetOps/App"`, где `fleetOps` — имя remote из реестра Module Federation, а `./App` — экспортируемая точка входа (а не `"fleet-ops/FleetApp"`).
2. **Module Federation v2**: Вместо прямого запроса `/remoteEntry.js` используется манифест манифестов `mf-manifest.json` для автоматического получения сведений о версии и чанках.
3. **mfe:ready**: Событие отправляется в шину `airlineSimEventBus` в виде объекта `{ remoteId: 'fleet-ops' }` (а не простой строки).
