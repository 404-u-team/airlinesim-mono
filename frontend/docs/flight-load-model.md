# Модель загрузки рейса (пассажиры на конкретный рейс)

> Статус: **проектируется и внедряется** (начато 2026-06-10). Считается в
> `frontend/bff/src/modules/operations/flights.ts` (`estimateFlightFinancials`).
> Источник рыночного спроса — [модель пассажирского спроса](passenger-demand-model.md).

## Что это и чем отличается от спроса

[Модель спроса](passenger-demand-model.md) даёт **рыночный потенциал пары** —
сколько человек в сутки в принципе хотят лететь из A в B (в одну сторону, до
конкуренции и до вашего расписания). Эта модель отвечает на другой вопрос: **сколько из
них сядет именно на ваш конкретный рейс** с учётом частоты, цены и ёмкости.

## Проблемы прежней формулы (v1)

```text
demandPerFlight = dailyDemand * 7 / daysPerWeek
loadFactor      = clamp(demandPerFlight / seats, 0.35, 0.95)
passengers      = round(seats * loadFactor)
```

1. `* 7 / daysPerWeek` **награждает редкость**: летая 3 раза в неделю, вы будто
   собираете недельный спрос на 3 рейса → искусственно высокий load factor. В
   реальности пассажиры не ждут несколько дней — редкое расписание *теряет* спрос, а не
   концентрирует его.
2. **Пол `0.35`** — рейс на полупустом рынке всё равно «едет» на 35%. Это маскирует
   плохие маршруты, которые игрок должен видеть как убыточные.
3. **Нет влияния частоты** на захват рынка (больше частот → удобнее → больше доля).
4. **Нет влияния цены** (тарифа) на спрос.
5. Нет spill/recapture при переполнении.

## Формула v2

Считаем на недельной базе (совпадает с `days_of_week` расписания), направление —
своё (outbound/return используют свой `*_daily_passengers`).

### 1. Эффективный рыночный спрос (с учётом тарифа)

```text
M_week = directional_daily_demand · 7
fareRatio = fare / referenceFare(distance)
M_eff = M_week · fareRatio^(-ε)            # ε ≈ 1.1 — эластичность по цене
```

`referenceFare(distance)` — типичный тариф для такой дистанции (та же база, что в
route economics). Тариф выше эталона → спроса меньше, ниже → больше. `ε` калибруется.

### 2. Захват рынка частотой (S-кривая)

Чем чаще летаешь, тем большую долю рынка ловишь (удобство расписания). Для MVP без
конкурентов:

```text
f = flightsPerWeek / 7                      # дневной эквивалент частоты
captureShare = 1 − exp(−f / f0)             # f0 ≈ 0.7
captured_week = M_eff · captureShare
```

Свойства: 3 рейса/нед → ~46% рынка, ежедневно → ~76%, 2/день → ~94%. Монополист не
забирает 100% — часть рынка выбирает другие даты/виды транспорта. (При появлении
конкурентов доля заменяется на QSI/frequency-share — см. ниже.)

### 3. Распределение по рейсам + spill

```text
pax_per_flight = min(seats · maxLF, captured_week / flightsPerWeek)
load_factor    = pax_per_flight / seats     # без искусственного пола
maxLF ≈ 0.92
```

Если рынок тонкий — load factor честно низкий (сигнал игроку, что маршрут слабый). Если
рынок переполняет рейсы (`captured_week / F > seats·maxLF`) — лишнее «спиллится»
(теряется в MVP; в будущем — рекаптур на свои же другие рейсы).

## Влияние на экономику

`passengers = round(pax_per_flight)`, дальше как раньше:
`revenue = fare · passengers`, `cost` — топливо/обслуживание/сборы (см.
[fuel](../bff/src/modules/fuel) и route economics).

## Что осознанно не моделируем в MVP

- **Конкуренция / market-share.** Полноценная multinomial-logit/QSI модель требует цен,
  частот, расписаний и качества конкурентов, пересадок, loyalty. Этого пока нет —
  захват частотой считается как для монополиста. Точка расширения: заменить
  `captureShare` на `QSI_yours / Σ QSI_competitors`.
- **Классы обслуживания** (business/economy) — единый салон.
- **Сетевой/transfer-спрос** — только O&D пары, без пересадочных потоков через хаб.
- **Сезонность и события** — базовая среднегодовая загрузка.

## Источники и обоснование

- **S-кривая «доля рынка ≈ доля частоты»** — стандарт сетевого планирования
  авиакомпаний (доля рынка растёт с долей частот по выпуклой кривой, показатель ~1.3–1.7).
  Обзор: *Airline Network Planning and Scheduling* (Belobaba et al., «The Global Airline
  Industry»); QSI (Quality of Service Index) — классический метод оценки доли.
  - Belobaba, Odoni, Barnhart (eds.), **The Global Airline Industry**, Wiley — гл. по
    network planning / fleet assignment.
- **Эластичность спроса по тарифу** ε ≈ 0.8–1.5 (короткие/leisure выше, длинные/business
  ниже): IATA/InterVISTAS, *Estimating Air Travel Demand Elasticities* (2007) —
  <https://www.iata.org/en/iata-repository/publications/economic-reports/estimating-air-travel-demand-elasticities---by-intervistas/>

## Статус реализации

- [x] Чистый модуль `operations/passenger-load.ts` (эластичность + S-curve + spill), покрыт тестами
- [x] `estimateFlightFinancials` переведён на `expectedPassengersPerFlight`
- [x] Убран пол load factor 0.35 (теперь `[0, 0.92]`)
- [x] `referenceFare(distance)` единый для route economics и load-модели (нет дрейфа)
- [x] Тесты: тонкий рынок, переполнение (spill cap), эластичность по тарифу, S-curve
- [ ] Конкуренция/market-share (QSI) — точка расширения, не в MVP
