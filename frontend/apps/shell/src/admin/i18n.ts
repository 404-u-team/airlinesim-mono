import type { Locale } from "@airlinesim/i18n";

const messages = {
  en: {
    actions: "Actions", admin: "Admin", cancel: "Cancel", capabilities: "Capabilities",
    capabilitiesDescription: "Capabilities remain disabled until their backend and OpenAPI contracts are complete.", confirmDelete: "Confirm delete",
    confirmDiscard: "Discard changes", create: "Create", delete: "Delete", deleteDescription: "The backend may reject deletion when dependencies exist.",
    deleteTitle: "Delete this record?", disabled: "Disabled", discardDescription: "This form has unsaved changes. Discard them?",
    edit: "Edit", empty: "No records returned by the API.", enabled: "Enabled",
    loading: "Loading...", locked: "Locked", missing: "Missing", openapi: "OpenAPI enabled", readiness: "World readiness",
    records: "Records", refresh: "Refresh", save: "Save", search: "Search records", selectCountry: "Select country",
    selectRegion: "Select region", technical: "Uses request fields from the current OpenAPI schema.", toBeEnabled: "To be enabled",
    total: "total", unlock: "Enable when", worldImport: "World data import",
  },
  ru: {
    actions: "Действия", admin: "Админка", cancel: "Отмена", capabilities: "Возможности",
    capabilitiesDescription: "Возможности отключены до готовности соответствующих контрактов backend и OpenAPI.", confirmDelete: "Подтвердить удаление",
    confirmDiscard: "Отменить изменения", create: "Создать", delete: "Удалить", deleteDescription: "Backend может отклонить удаление, если существуют зависимости.",
    deleteTitle: "Удалить эту запись?", disabled: "Отключено", discardDescription: "В форме есть несохранённые изменения. Отменить их?",
    edit: "Изменить", empty: "API не вернул записей.", enabled: "Доступно",
    loading: "Загрузка...", locked: "Недоступно", missing: "Отсутствует", openapi: "Доступно через OpenAPI", readiness: "Готовность мира",
    records: "Записи", refresh: "Обновить", save: "Сохранить", search: "Поиск записей", selectCountry: "Выберите страну",
    selectRegion: "Выберите регион", technical: "Поля запроса определяются текущей схемой OpenAPI.", toBeEnabled: "Будущие возможности",
    total: "всего", unlock: "Условие включения", worldImport: "Импорт данных мира",
  },
} as const;

const ruLabels: Record<string, string> = {
  "Aircraft tail code": "Префикс бортового номера",
  "Airport catalog, fees and geospatial fields from the OpenAPI Airport schema.": "Каталог аэропортов, сборы и географические поля из схемы OpenAPI Airport.", Airports: "Аэропорты", Business: "Бизнес",
  "Business score": "Оценка бизнеса", Capabilities: "Возможности", Code: "Код", Continent: "Континент", "Corporate tax rate": "Корпоративный налог",
  Countries: "Страны",
  "Countries, tax rates and permission pricing from the OpenAPI Country schema.": "Страны, налоговые ставки и стоимость разрешений из схемы OpenAPI Country.", Country: "Страна", Diaspora: "Диаспора", "Elevation, ft": "Высота, футы",
  "Flythrough permission price": "Стоимость разрешения на пролёт", "Fuel price multiplier": "Множитель цены топлива",
  "Gate fee": "Сбор за гейт", "GDP per capita": "ВВП на душу населения", Geography: "География", Geometry: "Геометрия",
  "Home link": "Домашняя страница", IATA: "IATA", "IATA code": "Код IATA", ICAO: "ICAO", "ICAO code": "Код ICAO",
  "International name": "Международное название", "Land permission price": "Стоимость разрешения на посадку",
  "Local code": "Локальный код", "Local name": "Локальное название", "Maintenance point price": "Стоимость maintenance point",
  "Max runway length, m": "Максимальная длина ВПП, м", "Max runway uses per day": "Использований ВПП в день",
  Municipality: "Муниципалитет", Population: "Население", Region: "Регион", "Region A": "Регион A", "Region B": "Регион B",
  "Region Links": "Связи регионов", Regions: "Регионы", "Regions, demand scores and country ownership from the OpenAPI Region schema.": "Регионы, показатели спроса и принадлежность к странам из схемы OpenAPI Region.", "Runway fee": "Сбор за ВПП",
  "Stand fee": "Сбор за стоянку",
  "Symmetric demand links between regions from the OpenAPI Region Link schema.": "Симметричные связи спроса между регионами из схемы OpenAPI Region Link.",
  Timezone: "Часовой пояс", Tourism: "Туризм", "Tourism score": "Оценка туризма", "Turnaround point price": "Стоимость turnaround point",
  "VAT rate": "Ставка НДС", "Wikipedia link": "Ссылка Wikipedia", "Works at night": "Работает ночью",
};

export type AdminMessageKey = keyof typeof messages.en;

export function adminText(locale: Locale, key: AdminMessageKey): string {
  return messages[locale][key];
}

export function localizeAdminLabel(locale: Locale, label: string): string {
  return locale === "ru" ? ruLabels[label] ?? label : label;
}
