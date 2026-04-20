-- +goose Up
CREATE TABLE country (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    iso VARCHAR(3) UNIQUE NOT NULL,                  -- ISO 3166-1
    local_name VARCHAR(255) NOT NULL,
    intl_name VARCHAR(255) NOT NULL,
    flythrough_permission_price NUMERIC,
    land_permission_price NUMERIC,
    corp_tax_rate NUMERIC CHECK (corp_tax_rate >= 0 AND corp_tax_rate <= 100),
    vat_rate NUMERIC CHECK (vat_rate >= 0 AND vat_rate <= 100),
    aircraft_tail_code VARCHAR(10),
    wikipedia_link TEXT
);

CREATE TABLE region (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    local_code VARCHAR(20) UNIQUE NOT NULL,          -- e.g. US-NY
    local_name VARCHAR(255) NOT NULL,
    intl_name VARCHAR(255) NOT NULL,
    country_id UUID NOT NULL REFERENCES country(id) ON DELETE RESTRICT,
    population NUMERIC,
    gdp_per_capita NUMERIC,
    tourism_score NUMERIC CHECK (tourism_score >= 0 AND tourism_score <= 1),
    business_score NUMERIC CHECK (business_score >= 0 AND business_score <= 1),
    wikipedia_link TEXT
);

CREATE TABLE region_link (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    region_a UUID NOT NULL REFERENCES region(id) ON DELETE CASCADE,
    region_b UUID NOT NULL REFERENCES region(id) ON DELETE CASCADE,
    diaspora NUMERIC CHECK (diaspora >= 0 AND diaspora <= 1),
    business NUMERIC CHECK (business >= 0 AND business <= 1),
    tourism NUMERIC CHECK (tourism >= 0 AND tourism <= 1),
    CHECK (region_a < region_b)                      -- enforce symmetry, avoid duplicates
);

CREATE TABLE airport (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    icao_code CHAR(4) UNIQUE,
    iata_code CHAR(3) UNIQUE,
    local_name VARCHAR(255),
    intl_name VARCHAR(255),
    timezone VARCHAR(50) NOT NULL,                   -- IANA timezone
    country_id UUID NOT NULL REFERENCES country(id) ON DELETE RESTRICT,
    region_id UUID NOT NULL REFERENCES region(id) ON DELETE RESTRICT,
    municipality VARCHAR(255),
    continent CHAR(2) CHECK (continent IN ('AF','AN','AS','EU','NA','OC','SA')),
    elevation_ft NUMERIC,
    max_runway_length_m NUMERIC,
    works_at_night BOOLEAN NOT NULL DEFAULT TRUE,
    max_runway_uses_per_day NUMERIC,                 -- дефолт
    turnaround_point_price NUMERIC,                  -- дефолт $/очко
    maintenance_point_price NUMERIC,                 -- дефолт $/очко
    runway_fee NUMERIC,                              -- дефолт
    gate_fee NUMERIC,                                -- дефолт
    stand_fee NUMERIC,                               -- дефолт
    fuel_price_multiplier NUMERIC,
    home_link TEXT,
    wikipedia_link TEXT,
    geog GEOGRAPHY,                                  -- POSTGIS geography
    geom GEOMETRY                                    -- POSTGIS geometry
);

-- +goose Down
DROP TABLE IF EXISTS country;

DROP TABLE IF EXISTS region;

DROP TABLE IF EXISTS region_link;

DROP TABLE IF EXISTS airport;