package repository

import (
	"context"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/db"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	"github.com/google/uuid"
)

type AirlineRepository interface {
	CreateAirline(ctx context.Context, payload *airlinepb.CreateAirlineRequest, gameTime time.Time) (uuid.UUID, error)
}

type airlineRepository struct {
	pool db.DBConn
}

func NewAirlineRepository(pool db.DBConn) AirlineRepository {
	return &airlineRepository{pool: pool}
}

// create airline with default values
func (r *airlineRepository) CreateAirline(ctx context.Context, payload *airlinepb.CreateAirlineRequest, gameTime time.Time) (uuid.UUID, error) {
	query := `
		INSERT INTO airline (
			owner_id, starting_airport_id, name, iata_code,
            icao_code, equity_cached_at_g, created_at_g
		)
		VALUES (
			$1, $2, $3, $4, $5, $6,
			$7	
		)
		RETURNING id
	`

	var airlineID uuid.UUID
	err := r.pool.QueryRow(
		ctx,
		query,
		payload.OwnerId,
		payload.StartingAirportId,
		payload.Name,
		payload.IataCode,
		payload.IcaoCode,
		gameTime,
		gameTime,
	).Scan(&airlineID)

	return airlineID, err
}
