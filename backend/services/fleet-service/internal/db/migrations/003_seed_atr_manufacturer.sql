-- +goose Up

INSERT INTO aircraft_manufacturer (id, name, logo_upload_id, market_name, production_points_per_week)
VALUES ('44444444-4444-4444-4444-444444444444', 'ATR', NULL, 'ATR', 240)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	market_name = EXCLUDED.market_name,
	production_points_per_week = EXCLUDED.production_points_per_week;

-- +goose Down

DELETE FROM aircraft_manufacturer
WHERE id = '44444444-4444-4444-4444-444444444444';
