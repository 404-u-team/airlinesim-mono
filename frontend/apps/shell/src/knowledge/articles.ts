import type { Locale } from "@airlinesim/i18n";

import type { ShellMessageKey } from "../i18n/messages";

export type KnowledgeArticle = {
  body: Record<Locale, string[]>;
  category: ShellMessageKey;
  id: string;
  links?: KnowledgeArticleLink[];
  title: Record<Locale, string>;
};

export type KnowledgeArticleLink = {
  label: Record<Locale, string>;
  path: string;
};

export const knowledgeArticles: KnowledgeArticle[] = [
  {
    body: {
      en: [
        "Welcome to AirlineSim! Your primary cockpit is the Dashboard, featuring an interactive world map. From here, you can track your entire network and watch flights travel in real-time.",
        "Your current balance is {balance}. Keep an eye on the Status Metrics bar at the top of the sidebar, which monitors your cash, active alerts ({alertsCount}), and the current fuel price ({fuelPrice} per tonne).",
        "To get started, check the Recommended Next Step at the bottom of the map (currently: {nextActionDescription}). This dynamic helper will guide you through ordering aircraft, planning routes, and activating schedules."
      ],
      ru: [
        "Добро пожаловать в AirlineSim! Ваша главная рабочая область — это Дашборд с интерактивной картой мира. Отсюда вы можете управлять всей своей сетью и наблюдать за полетами в реальном времени.",
        "Текущий баланс вашей авиакомпании равен {balance}. Полезно следить за показателями вверху бокового меню: там отображаются свободные средства, активные предупреждения ({alertsCount}) и текущая стоимость топлива ({fuelPrice} за тонну).",
        "В качестве подсказки используйте карточку «Рекомендуемый шаг» внизу карты (сейчас там: {nextActionDescription}). Этот помощник динамически проведет вас по всей цепочке запуска компании."
      ]
    },
    category: "knowledge.category.guide",
    id: "first-steps",
    links: [
      { label: { en: "Open Dashboard", ru: "Открыть Дашборд" }, path: "/dashboard" },
      { label: { en: "Check Alerts", ru: "Предупреждения" }, path: "/events/notifications" }
    ],
    title: { en: "01. Cockpit & Dashboard", ru: "01. Панель управления" }
  },
  {
    body: {
      en: [
        "Your airline is based at {hubLabel} (ICAO/IATA: {hubCode}). Every airport in the world has physical and operational limits that directly affect your operations.",
        "1. Runway Length: Your base runway length is {runwayLength}. Aircraft require a minimum takeoff run; if an aircraft's required runway exceeds this length, it cannot operate at this airport.",
        "2. Slot Capacity: Your base has a daily limit of {slotsLimit}. Each flight consumes one slot for takeoff and one for landing. If your weekly schedule exceeds 100% of slot capacity, further schedules will be blocked.",
        "3. Night Operations: Some airports enforce night curfews (23:00 - 06:00 local time). Flight schedules operating within these curfew hours will be blocked from activation."
      ],
      ru: [
        "Ваша стартовая база расположена в аэропорту {hubLabel} (ICAO/IATA: {hubCode}). Каждый аэропорт имеет строгие физические и эксплуатационные лимиты, которые необходимо учитывать при планировании.",
        "1. Длина ВПП: Полоса вашего хаба имеет длину {runwayLength}. Каждая модель самолета требует определенной дистанции для разбега; если требования самолета превышают длину ВПП, совершать полеты из этого порта нельзя.",
        "2. Лимит слотов: Лимит операций вашего хаба составляет {slotsLimit}. Каждая взлетно-посадочная операция расходует один слот. Если загрузка превысит 100%, новые рейсы будут заблокированы.",
        "3. Ночные рейсы: Многие аэропорты закрыты с 23:00 до 06:00 местного времени. Планирование рейсов в этот промежуток приведет к ошибке валидации при активации расписания."
      ]
    },
    category: "knowledge.category.concepts",
    id: "base-hub",
    links: [
      { label: { en: "My Hubs", ru: "Мои хабы" }, path: "/airports/hubs" },
      { label: { en: "Route Planner", ru: "Планировщик" }, path: "/airports/routes" }
    ],
    title: { en: "02. Hub & Airport Constraints", ru: "02. Ограничения аэропортов" }
  },
  {
    body: {
      en: [
        "To buy aircraft, go to Fleet -> Order New. The catalog tags aircraft compatibility with your base and budget: Recommended (fully compatible), Available (purchasable with minor warnings), Risky (leaves very low cash reserve), or Blocked (insufficient funds or too short runway).",
        "To ensure financial stability, keep a cash buffer after purchase. The recommended safety reserve is calculated as max($5,000,000, 10% of aircraft price, 14 days of maintenance). Going below this reserve triggers a financial risk warning.",
        "Each aircraft requires a unique Tail Number (registration code) between 2 and 12 characters (e.g. N-102, HL-772). Your fleet currently has {aircraftCount} aircraft."
      ],
      ru: [
        "Для расширения флота откройте раздел Флот -> Заказать ВС. Каталог разделяет самолеты по совместимости с вашей базой и бюджетом: Recommended (подходит по всем параметрам), Available (доступен с предупреждениями), Risky (оставляет мало резервов) или Blocked (недостаточно денег или короткая ВПП).",
        "После покупки на счету должен остаться резерв безопасности: max($5 000 000, 10% от цены ВС, 14 дней обслуживания). Если остаток баланса упадет ниже этого лимита, система выдаст предупреждение о финансовом риске.",
        "Перед покупкой укажите уникальный регистрационный номер (Tail Number) длиной от 2 до 12 символов (например, HL-772). Сейчас в вашем флоте {aircraftCount} ВС."
      ]
    },
    category: "knowledge.category.guide",
    id: "buying-aircraft",
    links: [
      { label: { en: "Order Aircraft", ru: "Заказать ВС" }, path: "/fleet/order/new" },
      { label: { en: "Fleet Overview", ru: "Обзор флота" }, path: "/fleet/overview" }
    ],
    title: { en: "03. Fleet Acquisition & Reserves", ru: "03. Покупка самолетов" }
  },
  {
    body: {
      en: [
        "Establish connections using Airports -> Route Planner. Passenger demand is calculated based on population sizes, economic GDP weights, and distance between cities.",
        "Fares can be left at Auto-price (default reference fare relative to distance) or optimized via a paid Price Analysis. The optimizer runs a grid-search to find the optimal fare that maximizes passenger yields before load factor decays too far.",
        "Your airline currently has {activeRoutes} active routes. Saved routes appear on the dashboard map and are unlocked for weekly scheduling."
      ],
      ru: [
        "Прокладывайте новые авиалинии в разделе Аэропорты -> Маршруты. Пассажирский спрос между городами рассчитывается на основе численности населения, экономических индексов ВВП и расстояния.",
        "Тарифы на билеты могут быть базовыми (Авто-цена, равная эталону для данной дистанции) или оптимизированными через Анализ цен. Анализатор находит идеальный баланс цены билета и загрузки кресел.",
        "В данный момент у вашей авиакомпании {activeRoutes} активных маршрутов. После сохранения маршруты отображаются на карте дашборда и доступны для составления расписаний."
      ]
    },
    category: "knowledge.category.guide",
    id: "route-planning",
    links: [
      { label: { en: "Route Planner", ru: "Планировщик" }, path: "/airports/routes" },
      { label: { en: "My Routes", ru: "Мои маршруты" }, path: "/airports/my-routes" }
    ],
    title: { en: "04. Routes & Demand Model", ru: "04. Планирование маршрутов" }
  },
  {
    body: {
      en: [
        "Schedules bind an aircraft to routes on specific weekdays. Go to Operations -> Schedule to configure this. When adding flights, departure and arrival times are calculated in local times based on airport timezones.",
        "Between flights, the system enforces a strict Turnaround Time (passenger deplaning, cleaning, fueling, safety checks, and boarding). Scheduling a flight that overlaps with a turnaround block causes a validation conflict and blocks activation.",
        "Schedules also validate runway compatibility, slot availability at both ends, and night curfews. Overutilizing slots beyond 100% at any airport will block the entire schedule."
      ],
      ru: [
        "Расписания привязывают самолеты с маршрутами по дням недели. Настроить их можно в Операции -> Расписание. Время отправления и прибытия рассчитывается в местном времени аэропортов с учетом часовых поясов.",
        "Между рейсами система строго контролирует Время разворота (обслуживание самолета в аэропорту). Назначение рейса до окончания разворотного времени предыдущего приведет к конфликту и заблокирует сохранение.",
        "Система также проверяет совместимость ВПП, лимиты слотов и ночной комендантский час. Превышение 100% лимита слотов хотя бы в одном аэропорту заблокирует активацию расписания."
      ]
    },
    category: "knowledge.category.guide",
    id: "schedules",
    links: [
      { label: { en: "Manage Schedules", ru: "Управление расписанием" }, path: "/operations/schedule" },
      { label: { en: "Live Flights", ru: "Рейсы в небе" }, path: "/operations/live-flights" }
    ],
    title: { en: "05. Flight Scheduling & Turnaround", ru: "05. Расписание и разворот" }
  },
  {
    body: {
      en: [
        "When flights run, they progress through a detailed timeline. Under Operations -> Live Flights, you can monitor your active fleet. The flight phases are divided into Boarding (-30m), Departure (Gate-out), Taxi-out, Takeoff, Climb, Cruise, Descent, Landing, Taxi-in, Arrival (Gate-in), Deplaning (+15m), and Arrived.",
        "Live telemetry is simulated deterministically: Cruise altitude (up to FL390 depending on distance), ground speed profile (accelerating during takeoff and decelerating during landing), passenger count, and fuel burn (trip fuel + 12% reserve).",
        "On the dashboard map, the flight position is interpolated locally using the air_progress ratio (0 to 1), providing smooth aircraft movement without polling the backend server. There are currently {liveFlights} live flights."
      ],
      ru: [
        "В процессе выполнения рейсы проходят через подробную временную шкалу. В разделе Операции -> Рейсы в небе можно наблюдать за ходом полетов. Фазы делятся на Посадку (-30м), Вылет (выкатка), Руление на взлет, Взлет, Набор высоты, Эшелон, Снижение, Посадку, Руление к гейту, Заезд на гейт, Высадку (+15м) и Прибытие.",
        "Телеметрия рассчитывается детерминированно: высота полета (до FL390), скорость (разгон на взлете, крейсерская скорость ВС и торможение), число пассажиров и расход топлива (трип-топливо + 12% резерв).",
        "На карте дашборда положение самолета плавно интерполируется на клиенте по параметру air_progress (от 0 до 1), без постоянных запросов к серверу. Сейчас выполняется {liveFlights} рейсов."
      ]
    },
    category: "knowledge.category.concepts",
    id: "telemetry",
    links: [
      { label: { en: "Live Flights", ru: "Рейсы в небе" }, path: "/operations/live-flights" },
      { label: { en: "Open Dashboard", ru: "Открыть Дашборд" }, path: "/dashboard" }
    ],
    title: { en: "06. Flight Telemetry & Phases", ru: "06. Телеметрия полетов" }
  },
  {
    body: {
      en: [
        "Completed flights post actual financials to your ledger under Finances -> Overview. Revenues are generated from ticket sales, while expenses include trip fuel, airport fees (landing runway fees, gate stand fees, passenger turnaround fees), and maintenance reserves.",
        "Passenger load factors (LF) depend directly on ticket pricing. The pricing model assumes a price elasticity exponent of ε = 1.1. Setting fares too high reduces captured demand exponentially.",
        "Fuel prices walk simulated trends: price updates periodically at /fuel/price. Watch the fuel price on the metrics bar to buy fuel cost-effectively."
      ],
      ru: [
        "Завершенные рейсы записывают финансовые данные в журнал в разделе Финансы -> Обзор. Доходы идут от продажи билетов, а расходы включают топливо, аэропортовые сборы (взлет-посадка, стоянка, гейт) и резервы обслуживания.",
        "Количество пассажиров (Load Factor) напрямую зависит от цен на билеты. Модель спроса использует коэффициент эластичности ε = 1.1. Завышение тарифа ведет к экспоненциальному падению спроса.",
        "Цены на топливо колеблются по симулируемым трендам на /fuel/price. Следите за графиком в меню операций, чтобы заправлять баки в моменты падения рынка."
      ]
    },
    category: "knowledge.category.concepts",
    id: "finances",
    links: [
      { label: { en: "Finances Overview", ru: "Обзор финансов" }, path: "/finances/overview" },
      { label: { en: "Fuel Market", ru: "Рынок топлива" }, path: "/operations/fuel" }
    ],
    title: { en: "07. Finances & Fuel Markets", ru: "07. Финансы и рынок топлива" }
  }
];
