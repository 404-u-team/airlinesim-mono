# Контракт map-state

Dashboard принадлежит `apps/shell`, а `apps/map` используется как визуальный remote-виджет. Карта не ходит в backend напрямую: shell загружает данные из BFF и передает их в map remote через props.

## Источник данных

Основной endpoint:

```http
GET /game/map-state?scope=dashboard&include_opportunities=true
```

Endpoint требует пользовательский `Authorization` token. BFF собирает данные из существующих backend routes и возвращает frontend-facing GeoJSON read model.

## Структура

- `airports` - GeoJSON FeatureCollection с точками стартовой базы и важных аэропортов.
- `routes` - GeoJSON FeatureCollection с линиями маршрутов. Пока backend routes/flights отсутствуют, массив пустой, а `capabilities.routes = "not_configured"`.
- `selected` - карточка выбранного аэропорта для shell detail panel.
- `viewport` - подсказка карте: `bounds` или `center`/`zoom`.
- `warnings` - предупреждения о неполных данных, например отсутствующих координатах.

## Поведение карты

`apps/map` отвечает только за визуализацию:

- добавляет airport/route sources and layers;
- восстанавливает игровые слои после смены MapLibre style;
- центрирует карту по `viewport`;
- отправляет `map:airport-selected` и `map:route-selected` через `@airlinesim/event-bus`.

Shell отвечает за продуктовый смысл выбора: detail panel, CTA и навигацию.
