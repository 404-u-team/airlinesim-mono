package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/google/uuid"
)

type AirportRepository interface {
	CreateAirport(ctx context.Context, payload *worldpb.CreateAirportRequest) (uuid.UUID, error)
	ChangeAirport(ctx context.Context, payload *worldpb.ChangeAirportRequest) (bool, error)
	ListAirports(ctx context.Context) ([]*worldpb.Airport, error)
	DeleteAirport(ctx context.Context, id uuid.UUID) (bool, error)
}

type airportRepository struct {
	pool db.DBConn
}

func NewAirportRepository(pool db.DBConn) AirportRepository {
	return &airportRepository{pool: pool}
}

func (r *airportRepository) CreateAirport(ctx context.Context, payload *worldpb.CreateAirportRequest) (uuid.UUID, error) {
	query := `
		INSERT INTO airport (
			icao_code, iata_code, local_name, intl_name, timezone, country_id,
			region_id, municipality, continent, elevation_ft, max_runway_length_m,
			works_at_night, max_runway_uses_per_day, turnaround_point_price,
			maintenance_point_price, runway_fee, gate_fee, stand_fee,
			fuel_price_multiplier, home_link, wikipedia_link, geog, geom
		)
		VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14,
			$15, $16, $17, $18,
			$19, $20, $21, NULLIF($22, '')::geography, NULLIF($23, '')::geometry
		)
		RETURNING id
	`

	var airportID uuid.UUID
	err := r.pool.QueryRow(
		ctx,
		query,
		payload.IcaoCode,
		payload.IataCode,
		payload.LocalName,
		payload.IntlName,
		payload.Timezone,
		payload.CountryId,
		payload.RegionId,
		payload.Municipality,
		payload.Continent,
		payload.ElevationFt,
		payload.MaxRunwayLengthM,
		payload.WorksAtNight,
		payload.MaxRunwayUsesPerDay,
		payload.TurnaroundPointPrice,
		payload.MaintenancePointPrice,
		payload.RunwayFee,
		payload.GateFee,
		payload.StandFee,
		payload.FuelPriceMultiplier,
		payload.HomeLink,
		payload.WikipediaLink,
		payload.Geog,
		payload.Geom,
	).Scan(&airportID)

	return airportID, err
}

func (r *airportRepository) ChangeAirport(ctx context.Context, payload *worldpb.ChangeAirportRequest) (bool, error) {
	result, err := r.pool.Exec(ctx, `
		UPDATE airport
		SET icao_code=$2, iata_code=$3, local_name=$4, intl_name=$5, timezone=$6,
			country_id=$7, region_id=$8, municipality=$9, continent=$10, elevation_ft=$11,
			max_runway_length_m=$12, works_at_night=$13, max_runway_uses_per_day=$14,
			turnaround_point_price=$15, maintenance_point_price=$16, runway_fee=$17,
			gate_fee=$18, stand_fee=$19, fuel_price_multiplier=$20, home_link=$21,
			wikipedia_link=$22, geog=NULLIF($23, '')::geography, geom=NULLIF($24, '')::geometry
		WHERE id=$1
	`, payload.Id, payload.IcaoCode, payload.IataCode, payload.LocalName, payload.IntlName, payload.Timezone,
		payload.CountryId, payload.RegionId, payload.Municipality, payload.Continent, payload.ElevationFt,
		payload.MaxRunwayLengthM, payload.WorksAtNight, payload.MaxRunwayUsesPerDay,
		payload.TurnaroundPointPrice, payload.MaintenancePointPrice, payload.RunwayFee,
		payload.GateFee, payload.StandFee, payload.FuelPriceMultiplier, payload.HomeLink,
		payload.WikipediaLink, payload.Geog, payload.Geom)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
}

func (r *airportRepository) ListAirports(ctx context.Context) ([]*worldpb.Airport, error) {
	query := `
		SELECT
			id::text,
			COALESCE(icao_code, ''),
			COALESCE(iata_code, ''),
			COALESCE(local_name, ''),
			COALESCE(intl_name, ''),
			timezone,
			country_id::text,
			region_id::text,
			COALESCE(municipality, ''),
			COALESCE(continent, ''),
			COALESCE(elevation_ft, 0),
			COALESCE(max_runway_length_m, 0),
			works_at_night,
			COALESCE(max_runway_uses_per_day, 0),
			COALESCE(turnaround_point_price, 0),
			COALESCE(maintenance_point_price, 0),
			COALESCE(runway_fee, 0),
			COALESCE(gate_fee, 0),
			COALESCE(stand_fee, 0),
			COALESCE(fuel_price_multiplier, 0),
			COALESCE(home_link, ''),
			COALESCE(wikipedia_link, ''),
			COALESCE(geog::text, ''),
			COALESCE(geom::text, '')
		FROM airport
		ORDER BY local_name
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	airports := make([]*worldpb.Airport, 0)
	for rows.Next() {
		var airport worldpb.Airport
		if err := rows.Scan(
			&airport.Id,
			&airport.IcaoCode,
			&airport.IataCode,
			&airport.LocalName,
			&airport.IntlName,
			&airport.Timezone,
			&airport.CountryId,
			&airport.RegionId,
			&airport.Municipality,
			&airport.Continent,
			&airport.ElevationFt,
			&airport.MaxRunwayLengthM,
			&airport.WorksAtNight,
			&airport.MaxRunwayUsesPerDay,
			&airport.TurnaroundPointPrice,
			&airport.MaintenancePointPrice,
			&airport.RunwayFee,
			&airport.GateFee,
			&airport.StandFee,
			&airport.FuelPriceMultiplier,
			&airport.HomeLink,
			&airport.WikipediaLink,
			&airport.Geog,
			&airport.Geom,
		); err != nil {
			return nil, err
		}

		airports = append(airports, &airport)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return airports, nil
}

func (r *airportRepository) DeleteAirport(ctx context.Context, id uuid.UUID) (bool, error) {
	result, err := r.pool.Exec(ctx, `DELETE FROM airport WHERE id=$1`, id)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
}
