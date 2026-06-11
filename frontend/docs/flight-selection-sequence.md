# Сценарий выбора рейса на карте и синхронизации с Dashboard

Эта диаграмма описывает реальный процесс выбора рейса/самолета пользователем на карте (`apps/map`) и последующий показ карточки рейса в боковой панели дашборда Shell.

```plantuml
@startuml
actor "Пользователь" as User
participant "World Map MFE (Svelte)" as Map
participant "MapManager (Svelte)" as Mgr
participant "airlineSimEventBus (Singleton)" as EventBus
participant "DashboardView (Shell)" as Dashboard
participant "useFlightCard (Shell Hook)" as Hook
participant "BFF (Backend for Frontend)" as BFF
participant "DashboardFlightCard (Shell)" as Card

User -> Map : Клик на иконку самолёта на карте
Map -> Mgr : Обработка клика handleFlightClick(event)
Mgr -> EventBus : emit('flight:selected', { flightId: 'CCA862', source: 'map' })

note over EventBus : Распространение события подписчикам
EventBus -> Dashboard : Вызов обработчика (on('flight:selected'))

Dashboard -> Hook : Вызов openFlight('CCA862')
activate Hook
Hook -> BFF : GET /bff/dashboard/flights/CCA862
BFF --> Hook : Детали полёта (DashboardFlightDetail)
Hook -> Hook : Обновление selectedFlight.value
deactivate Hook

Dashboard -> Card : Монтирование/Рендеринг в боковой панели (aside)
Card --> User : Отображение карточки полёта с ETA и телеметрией
@enduml
```

## Ключевые отличия от старой схемы (MFE_EXAMPLE.png):
1. **Подписчики на события**: Модуль `fleet-ops` вообще не слушает и не реагирует на событие `flight:selected` в рамках этого дашборд-сценария.
2. **Владелец данных и рендеринга**: Маршрут `/dashboard` и сам Dashboard полностью принадлежат Shell. Загрузка данных по рейсу происходит из Shell через BFF-эндпоинт (`/bff/dashboard/flights/:id`), и рендеринг карточки рейса (`DashboardFlightCard.vue`) выполняется на стороне Shell, а не удаленным приложением.
3. **Визуальный виджет**: Модуль `apps/map` выступает исключительно как интерактивный визуальный виджет, получающий состояние сети от Shell и отправляющий события взаимодействия обратно в Shell через общую шину событий.
