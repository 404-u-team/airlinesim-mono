-- +goose Up
-- MVP playability: a new airline must be able to afford at least one starter
-- aircraft (cheapest is ~26M) plus an operating reserve. The original 1,000,000
-- default left every new player unable to buy any aircraft, blocking the whole
-- game loop. Raise the default and top up existing airlines that are stuck below
-- the price of the cheapest aircraft.
ALTER TABLE airline ALTER COLUMN balance SET DEFAULT 100000000;
UPDATE airline SET balance = 100000000 WHERE balance < 30000000 AND is_bankrupt = FALSE;

-- +goose Down
ALTER TABLE airline ALTER COLUMN balance SET DEFAULT 1000000;
