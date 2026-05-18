package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/db"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	"github.com/google/uuid"
)

type AirlineRepository interface {
	CreateAirline(ctx context.Context, payload *airlinepb.CreateAirlineRequest) (uuid.UUID, float64, error)
}

type airlineRepository struct {
	pool db.DBConn
}

func NewAirlineRepository(pool db.DBConn) AirlineRepository {
	return &airlineRepository{pool: pool}
}

// create airline with default values
func (r *airlineRepository) CreateAirline(ctx context.Context, payload *airlinepb.CreateAirlineRequest) (uuid.UUID, float64, error) {
	query := `
		INSERT INTO airline (
			owner_id, starting_airport_id, name, iata_code, icao_code
		)
		VALUES (
			$1, $2, $3, $4, $5, $6,
			$7	
		)
		RETURNING id, balance
	`

	var airlineID uuid.UUID
	var balance float64
	err := r.pool.QueryRow(
		ctx,
		query,
		payload.OwnerId,
		payload.StartingAirportId,
		payload.Name,
		payload.IataCode,
		payload.IcaoCode,
	).Scan(&airlineID, &balance)

	return airlineID, balance, err
}
