-- +goose Up

INSERT INTO aircraft_manufacturer (id, name, logo_upload_id, market_name, production_points_per_week) VALUES
	('11111111-1111-1111-1111-111111111111', 'Boeing', NULL, 'Boeing Commercial Airplanes', 1200),
	('22222222-2222-2222-2222-222222222222', 'Airbus', NULL, 'Airbus Commercial Aircraft', 1150),
	('33333333-3333-3333-3333-333333333333', 'Embraer', NULL, 'Embraer Commercial Aviation', 420);

INSERT INTO aircraft_type (
	id, manufacturer_id, model_name, icao_code, iata_code, image_upload_id,
	max_range_km, cruising_speed_kph, max_planned_seat_capacity, min_runway_length_m,
	production_points_price, base_turnaround_points, base_maintenance_points,
	maint_cost_per_takeoff, maint_cost_per_landing, maint_cost_per_flight_hour,
	d_check_interval_fh, d_check_interval_years, d_check_overdue_multiplier,
	fuel_consumption_per_hour, mtow_kg, price_per_unit, characteristics
) VALUES
	(
		'aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '737-800', 'B738', '738', NULL,
		5765, 842, 189, 2600,
		220, 45, 100,
		8, 6, 24,
		60000, 20, 1.15,
		2600, 79015, 102000000,
		'{"engine":"CFM56-7B","category":"narrow-body"}'::jsonb
	),
	(
		'bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'A320-200', 'A320', '320', NULL,
		6100, 828, 180, 2400,
		210, 42, 96,
		8, 6, 23,
		62000, 20, 1.12,
		2550, 73500, 98000000,
		'{"engine":"CFM56-5B","category":"narrow-body"}'::jsonb
	),
	(
		'cccc3333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'E190-E2', 'E190', '190', NULL,
		5300, 870, 114, 1800,
		150, 30, 70,
		6, 4, 18,
		45000, 15, 1.08,
		1900, 51800, 56000000,
		'{"engine":"PW1900G","category":"regional-jet"}'::jsonb
	);


INSERT INTO aircraft_modifier (
	id, name, description, install_cost, extra_revenue_per_pax, seats_equivalent,
	max_maintenance_points_delta, maintenance_consumption_multiplier,
	maintenance_points_per_flight_delta, turnaround_points_delta, other_effects
) VALUES
	(
		'dddd4444-4444-4444-4444-444444444444', 'Winglets', 'Improves fuel efficiency on long sectors', 1800000,
		2.5, NULL, 4, 0.96, NULL, NULL,
		'{"fuel_saving_pct":4}'::jsonb
	),
	(
		'eeee5555-5555-5555-5555-555555555555', 'Premium Cabin', 'Adds premium seats and higher yield', 950000,
		12, 8, NULL, NULL, 1, -2,
		'{"premium_yield_multiplier":1.08}'::jsonb
	);

-- +goose Down
DELETE FROM aircraft_modifier WHERE id IN (
	'dddd4444-4444-4444-4444-444444444444',
	'eeee5555-5555-5555-5555-555555555555'
);


DELETE FROM aircraft_type WHERE id IN (
	'aaaa1111-1111-1111-1111-111111111111',
	'bbbb2222-2222-2222-2222-222222222222',
	'cccc3333-3333-3333-3333-333333333333'
);

DELETE FROM aircraft_manufacturer WHERE id IN (
	'11111111-1111-1111-1111-111111111111',
	'22222222-2222-2222-2222-222222222222',
	'33333333-3333-3333-3333-333333333333'
);