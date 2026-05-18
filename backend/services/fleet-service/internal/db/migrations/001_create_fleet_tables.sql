-- +goose Up
CREATE TABLE aircraft_manufacturer (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_upload_id UUID,
    market_name VARCHAR(255) NOT NULL,
    production_points_per_week NUMERIC NOT NULL
);

CREATE TABLE aircraft_type (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    manufacturer_id UUID NOT NULL REFERENCES aircraft_manufacturer(id) ON DELETE RESTRICT,
    model_name VARCHAR(255) NOT NULL,
    icao_code CHAR(4) NOT NULL UNIQUE,
    iata_code CHAR(3) NOT NULL UNIQUE,
    image_upload_id UUID,
    max_range_km NUMERIC NOT NULL,
    cruising_speed_kph NUMERIC NOT NULL,
    max_planned_seat_capacity NUMERIC NOT NULL,
    min_runway_length_m NUMERIC NOT NULL,
    production_points_price NUMERIC NOT NULL,
    base_turnaround_points NUMERIC NOT NULL,
    base_maintenance_points NUMERIC NOT NULL,
    maint_cost_per_takeoff NUMERIC NOT NULL,
    maint_cost_per_landing NUMERIC NOT NULL,
    maint_cost_per_flight_hour NUMERIC NOT NULL,
    d_check_interval_fh NUMERIC NOT NULL,
    d_check_interval_years NUMERIC NOT NULL,
    d_check_overdue_multiplier NUMERIC NOT NULL,
    fuel_consumption_per_hour NUMERIC NOT NULL,
    mtow_kg NUMERIC NOT NULL,
    price_per_unit NUMERIC NOT NULL,
    characteristics JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE aircraft (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type_id UUID NOT NULL REFERENCES aircraft_type(id) ON DELETE RESTRICT,
    current_owner_id UUID,
    base_airport_id UUID,
    tail_number CHAR(16) UNIQUE NOT NULL,
    in_service BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('idle', 'in_flight', 'turnaround', 'maintenance', 'building')),
    current_maintenance_points NUMERIC NOT NULL DEFAULT 0,
    max_maintenance_points_cached NUMERIC NOT NULL,
    total_flight_hours NUMERIC NOT NULL DEFAULT 0,
    fh_since_last_d_check NUMERIC NOT NULL DEFAULT 0,
    total_cycles NUMERIC NOT NULL DEFAULT 0,
    manufactured_at TIMESTAMP
);

CREATE TABLE aircraft_seat (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
    tariff_class_id UUID NOT NULL,
    count NUMERIC NOT NULL,
    UNIQUE (aircraft_id, tariff_class_id)
);

CREATE TABLE aircraft_modifier (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    install_cost NUMERIC NOT NULL,
    extra_revenue_per_pax NUMERIC,
    seats_equivalent NUMERIC,
    max_maintenance_points_delta NUMERIC,
    maintenance_consumption_multiplier NUMERIC,
    maintenance_points_per_flight_delta NUMERIC,
    turnaround_points_delta NUMERIC,
    other_effects JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE aircraft_modifier_instance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
    modifier_id UUID NOT NULL REFERENCES aircraft_modifier(id) ON DELETE RESTRICT,
    installed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE aircraft_order (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    airline_id UUID NOT NULL,
    manufacturer_id UUID NOT NULL REFERENCES aircraft_manufacturer(id) ON DELETE RESTRICT,
    aircraft_type_id UUID NOT NULL REFERENCES aircraft_type(id) ON DELETE RESTRICT,
    count NUMERIC NOT NULL,
    production_points NUMERIC NOT NULL,
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE maintenance_record (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    aircraft_id UUID NOT NULL REFERENCES aircraft(id) ON DELETE CASCADE,
    facility_id UUID,
    airport_id UUID NOT NULL,
    cost NUMERIC NOT NULL,
    points_restored NUMERIC NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(30) NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS maintenance_record;

DROP TABLE IF EXISTS aircraft_order;

DROP TABLE IF EXISTS aircraft_modifier_instance;

DROP TABLE IF EXISTS aircraft_modifier;

DROP TABLE IF EXISTS aircraft_seat;

DROP TABLE IF EXISTS aircraft;

DROP TABLE IF EXISTS aircraft_type;

DROP TABLE IF EXISTS aircraft_manufacturer;
