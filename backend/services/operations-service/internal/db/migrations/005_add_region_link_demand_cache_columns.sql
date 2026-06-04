-- +goose Up
ALTER TABLE region_link
    ADD COLUMN IF NOT EXISTS base_daily_demand_ab NUMERIC NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS base_daily_demand_ba NUMERIC NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS demand_cache_updated_at TIMESTAMP NOT NULL DEFAULT now();

-- +goose Down
ALTER TABLE region_link
    DROP COLUMN IF EXISTS demand_cache_updated_at,
    DROP COLUMN IF EXISTS base_daily_demand_ba,
    DROP COLUMN IF EXISTS base_daily_demand_ab;
