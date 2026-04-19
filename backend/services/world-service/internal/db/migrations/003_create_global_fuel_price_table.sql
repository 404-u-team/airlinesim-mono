-- +goose Up
CREATE TABLE global_fuel_price (
    id UUID PRIMARY KEY,
    price NUMERIC NOT NULL,                          -- базовая цена нефти
    recorded_at DATE NOT NULL
);


CREATE INDEX idx_global_fuel_price_date ON global_fuel_price(recorded_at);

-- +goose Down
DROP TABLE IF EXISTS global_fuel_price;
