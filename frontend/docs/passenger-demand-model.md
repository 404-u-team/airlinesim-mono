# Модель пассажирского спроса

## Назначение и источник истины

Источник истины для базового спроса между аэропортами — BFF-модуль
`bff/src/modules/demand`. Endpoint:

```http
GET /demand/airport-pair?origin_airport_id=<id>&destination_airport_id=<id>
```

BFF вычисляет среднесуточный базовый спрос между регионами аэропортов и сохраняет
его в backend `RegionLink.base_daily_demand_ab/ba`. Сохраненное значение является
среднегодовой базой: сезонность, события, конкуренция и тариф конкретной авиакомпании
не должны навсегда записываться в `RegionLink`.

Чистая расчетная модель находится в `bff/src/modules/demand/model.ts`.

## Входные данные

- население и ВВП на душу населения региона;
- расстояние между аэропортами;
- business/tourism/diaspora affinity связи регионов;
- принадлежность регионов одной стране;
- туристический и деловой scores региона;
- ВПП, пропускная способность, ночная работа, сборы, fuel multiplier и IATA-код аэропорта.

Если координаты отсутствуют, временный fallback distance равен `1500 km`.

## Реализованная формула

```text
G = K
  * PopA_mln^0.62 * PopB_mln^0.62
  * GDPpcA_thousand^0.55 * GDPpcB_thousand^0.55
  * D(distance)

K = 2.6
D(distance) = 1 / (1 + max(distance, 50) / 1800)^1.25
```

`K` — игровая калибровка для результата порядка среднесуточных пассажиров. Это не
научно оцененный коэффициент: он подобран по нескольким реальным O&D-якорям (см. ниже).

```text
AirportFactor = sqrt(AirportFactorA * AirportFactorB)

AffinityFactor =
  0.70
  + 0.75 * business
  + 0.55 * tourism
  + 0.45 * diaspora

DomesticMultiplier = 1.8, если регионы в одной стране, иначе 1.0
ShortHaul(distance) = clamp((distance_km - 60) / 240, 0, 1)

BaseDemand = G * AirportFactor * AffinityFactor * DomesticMultiplier * ShortHaul

Demand(A -> B) = BaseDemand * DirectionFactor(A, B)
Demand(B -> A) = BaseDemand * DirectionFactor(B, A)
```

`AirportFactor` учитывает доступность аэропорта. `DirectionFactor` учитывает
платежеспособность origin и туристическую/деловую привлекательность destination.
Поэтому спрос по направлениям может различаться.

`DomesticMultiplier` отражает, что внутренние рынки крупнее наивного гравитационного
предсказания (нет пограничного трения, слабее дальнее ж/д сообщение).
`ShortHaul` обнуляет спрос для очень близких пар (два аэропорта одной агломерации,
~40 км) — там никто не летает; это же отдельно блокирует создание маршрута
(`ROUTE_DISTANCE_TOO_SHORT`, порог 75 км) в `routes/planning.ts`.

## Калибровка 2026-06 и источники

Элестичности населения/ВВП на душу подняты ближе к диапазону литературы (0.6–0.8),
`K` поднят с 0.45 до 2.6, добавлены доменный множитель и short-haul-обнуление.
Калибровка сверена по реальным якорям (односторонний суточный O&D ≈ годовой/365):

- **Москва–Сочи (VKO–AER)** — самый загруженный внутренний маршрут РФ, ~5–7 млн/год
  в обе стороны → ~8000/день в одну сторону. Модель после калибровки ~2.3k (лидерные
  leisure-всплески статичная гравитация не ловит — честное ограничение).
- **Москва–Уфа (VKO–UFA)** — ~1500–2000/день. Модель ~1.8k.
- **Москва–Стамбул (VKO–IST)** — топ-3 международного у Аэрофлота → ~3000/день. Модель ~3.0k.
- **Москва–Копенгаген (VKO–CPH)** — в «несанкционном» мире ~600–1000/день. Модель ~1.5k
  (богатый, но малый Копенгаген немного завышается GDP-членом).

Источники:

- [Самые популярные авиамаршруты РФ (Сочи — №1)](https://www.oreanda-news.com/en/v_mire/the-most-popular-air-routes-for-tourists-in-russia-have-been-named/article1498461/)
- [Aeroflot top destinations H1 2024 (Сочи 1.5M только Аэрофлот-групп; Стамбул топ-3)](https://www.rusaviainsider.com/aeroflot-reveals-top-destinations-for-the-first-half-of-2024/)
- [List of the busiest airports in Russia (Wikipedia)](https://en.wikipedia.org/wiki/List_of_the_busiest_airports_in_Russia)
- Grosche, Rothlauf, Heinzl, *Gravity models for airline passenger volume estimation*, JATM 13(4) 2007 — [PDF](https://www.academia.edu/18428990/Gravity_models_for_airline_passenger_volume_estimation)
- *A global gravity model for air passenger demand between city pairs* (2018) — [ResearchGate](https://www.researchgate.net/publication/325963921_A_global_gravity_model_for_air_passenger_demand_between_city_pairs_and_future_interurban_air_mobility_markets_identification)

## Сравнение с Grosche et al.

Основа модели соответствует классу gravity models из:

Tobias Grosche, Franz Rothlauf, Armin Heinzl, **Gravity models for airline passenger
volume estimation**, Journal of Air Transport Management, Volume 13, Issue 4,
July 2007, pages 175–183.
[DOI: 10.1016/j.jairtraman.2007.02.001](https://doi.org/10.1016/j.jairtraman.2007.02.001).

В статье пассажиропоток моделируется произведением степенных функций
геоэкономических факторов и distance impedance. Подход подходит для пар, где еще
нет рейсов и исторических данных, что совпадает с задачей Network Planner.

Коэффициенты статьи нельзя напрямую переносить в игру:

- статья калибрована на proprietary booking data между Германией и 28 европейскими странами;
- модель статьи работает с городами/catchment areas, а у нас доступны регионы;
- у нас нет полного набора признаков статьи и реальной целевой матрицы пассажиропотоков;
- глобальный игровой мир неоднороден относительно европейской выборки статьи.

Поэтому реализована похожая по структуре, но явно игровая и калибруемая модель.

## Почему сейчас нет полноценной модели выбора авиакомпании

Gravity model оценивает общий потенциальный рынок пары, но не долю конкретной
авиакомпании. Для полноценной multinomial logit/market-share модели нужны цены,
частоты, расписания и качество предложений конкурентов, пересадки, loyalty и
доступная емкость. Этих данных сейчас нет.

Поэтому загрузка рейса в TODO6 распределяет общий спрос по частоте и вместимости и
ограничивает load factor. Это приемлемо для MVP, но не является конкурентной MNL-моделью.

## Кэширование и жизненный цикл

1. BFF находит аэропорты, регионы и `RegionLink`.
2. Если положительный базовый спрос уже сохранен, BFF возвращает его.
3. Иначе BFF вычисляет обе направленности.
4. Существующий `RegionLink` обновляется, отсутствующий создается.
5. Routes, schedules и flights используют сохраненный базовый спрос.

После изменения формулы сохраненные значения не пересчитываются автоматически.
Для новой версии модели потребуется управляемый пересчет region links.

## Ограничения и следующие улучшения

- откалибровать `K` и эластичности на открытой O&D выборке;
- хранить `demand_model_version` и confidence;
- отличать среднегодовую базу от сезонных и событийных множителей;
- учитывать competing airports/catchment overlap;
- после появления предложений конкурентов добавить market-share модель;
- убрать fallback distance за счет обязательных координат.

