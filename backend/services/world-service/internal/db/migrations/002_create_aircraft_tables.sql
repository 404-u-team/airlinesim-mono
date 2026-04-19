-- +goose Up
CREATE TABLE aircraft_manufacturer (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_upload_id UUID,                              -- FK to upload table
    market_name VARCHAR(255),
    production_points_per_week NUMERIC                -- production points per week
);

CREATE TABLE aircraft_type (
    id UUID PRIMARY KEY,
    manufacturer_id UUID NOT NULL REFERENCES aircraft_manufacturer(id) ON DELETE RESTRICT,
    model_name VARCHAR(255) NOT NULL,
    icao_code CHAR(4) UNIQUE,
    iata_code CHAR(3) UNIQUE,
    image_upload_id UUID,                             -- FK to upload table
    max_range_km NUMERIC,
    cruising_speed_kph NUMERIC,
    max_planned_seat_capacity NUMERIC,
    min_runway_length_m NUMERIC,
    production_points_price NUMERIC,                  -- очков на 1 шт
    base_turnaround_points NUMERIC,                   -- требуется на turnaround
    base_maintenance_points NUMERIC,                  -- максимум очков ТО
    maint_cost_per_takeoff NUMERIC,                   -- очков
    maint_cost_per_landing NUMERIC,                   -- очков
    maint_cost_per_flight_hour NUMERIC,               -- очков
    d_check_interval_fh NUMERIC,
    d_check_interval_years NUMERIC,
    d_check_overdue_multiplier NUMERIC,
    fuel_consumption_per_hour NUMERIC,
    mtow_kg NUMERIC,
    price_per_unit NUMERIC,
    characteristics JSONB,                           -- доп. данные, не используются в MVP
    created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE aircraft (
    id UUID PRIMARY KEY,
    type_id UUID NOT NULL REFERENCES aircraft_type(id) ON DELETE RESTRICT,
    current_owner_id UUID NOT NULL REFERENCES airline(id) ON DELETE RESTRICT,
    base_airport_id UUID NOT NULL REFERENCES airport(id) ON DELETE RESTRICT,
    tail_number CHAR(16) UNIQUE NOT NULL,
    in_service BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('idle', 'in_flight', 'turnaround', 'maintenance', 'building')),
    current_maintenance_points NUMERIC NOT NULL DEFAULT 0,
    max_maintenance_points_cached NUMERIC NOT NULL,   -- base + сумма модификаций; пересчёт при install/uninstall
    total_flight_hours NUMERIC NOT NULL DEFAULT 0,
    fh_since_last_d_check NUMERIC NOT NULL DEFAULT 0,
    total_cycles NUMERIC NOT NULL DEFAULT 0,
    manufactured_date DATE,                           -- manufacturing date (gDate in diagram)
    created_at DATE NOT NULL DEFAULT CURRENT_DATE
);


-- +goose Down

DROP TABLE IF EXISTS aircraft_manufacturer;

DROP TABLE IF EXISTS aircraft_type;

DROP TABLE IF EXISTS aircraft;