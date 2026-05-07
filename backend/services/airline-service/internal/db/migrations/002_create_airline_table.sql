-- +goose Up
CREATE TABLE airline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL,
    starting_airport_id UUID NOT NULL,
    name TEXT NOT NULL,
    iata_code CHAR(2) NOT NULL UNIQUE,
    icao_code CHAR(3) NOT NULL UNIQUE,
    balance NUMERIC(20,2) NOT NULL DEFAULT 1000000,
    equity_cached NUMERIC(20,2) NOT NULL DEFAULT 0, -- вычислимо; момент пересчёта ниже
    equity_cached_at_g NOT NULL TIMESTAMP,
    credit_rating SMALLINT NOT NULL CHECK (credit_rating BETWEEN 0 AND 100) DEFAULT 50,
    safety_rating SMALLINT NOT NULL CHECK (safety_rating BETWEEN 0 AND 100) DEFAULT 50,
    reputation SMALLINT NOT NULL CHECK (reputation BETWEEN 0 AND 100) DEFAULT 50,
    is_public BOOLEAN NOT NULL DEFAULT FALSE, -- после IPO
    is_bankrupt BOOLEAN NOT NULL DEFAULT FALSE,
    created_at_g TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE staff_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    airline_id UUID NOT NULL REFERENCES Airline(id) ON DELETE CASCADE,
    staff_type TEXT NOT NULL CHECK (staff_type IN ('pilot', 'cabin', 'technician', 'ground')), -- pilot/cabin/technician/ground
    headcount INTEGER NOT NULL CHECK (headcount >= 0),
    monthly_salary_per_person NUMERIC(10,2) NOT NULL CHECK (monthly_salary_per_person >= 0),
    staff_happiness SMALLINT CHECK (staff_happiness BETWEEN 0 AND 100)
);

CREATE TABLE airline_to_airport (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    airline_id UUID NOT NULL REFERENCES Airline(id) ON DELETE CASCADE,
    airport_id UUID NOT NULL,
    is_hub BOOLEAN NOT NULL DEFAULT FALSE,
    owned_fuel NUMERIC(12,2) NOT NULL DEFAULT 0,
    has_contract BOOLEAN NOT NULL DEFAULT FALSE,
    max_runway_uses_per_day INTEGER, -- override, nullable
    turnaround_point_price NUMERIC(10,2), -- override, nullable
    maintenance_point_price NUMERIC(10,2), -- override, nullable
    runway_fee NUMERIC(10,2), -- override, nullable
    gate_fee NUMERIC(10,2), -- override, nullable
    stand_fee NUMERIC(10,2), -- override, nullable
    UNIQUE (airline_id, airport_id)
);

-- +goose Down
DROP TABLE IF EXISTS airline;

DROP TABLE IF EXISTS staff_config;

DROP TABLE IF EXISTS airline_to_airport;