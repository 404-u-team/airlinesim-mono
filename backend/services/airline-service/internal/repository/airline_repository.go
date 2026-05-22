package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/db"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/google/uuid"
)

type AirlineRepository interface {
	CreateAirline(ctx context.Context, payload *airlinepb.CreateAirlineRequest) (uuid.UUID, float64, error)
	AdjustBalance(ctx context.Context, ownerID uuid.UUID, amount float64) (uuid.UUID, float64, error)
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

func (r *airlineRepository) AdjustBalance(ctx context.Context, ownerID uuid.UUID, amount float64) (uuid.UUID, float64, error) {
	query := `
		UPDATE airline
		SET balance = balance + $2
		WHERE owner_id = $1
		  AND balance + $2 >= 0
		RETURNING id, balance
	`

	var airlineID uuid.UUID
	var balance float64
	err := r.pool.QueryRow(ctx, query, ownerID, amount).Scan(&airlineID, &balance)
	if err == nil {
		return airlineID, balance, nil
	}

	checkQuery := `SELECT id FROM airline WHERE owner_id = $1`
	if checkErr := r.pool.QueryRow(ctx, checkQuery, ownerID).Scan(&airlineID); checkErr != nil {
		return uuid.Nil, 0, customerrors.ErrAirlineNotFound
	}

	return airlineID, 0, customerrors.ErrAirlineBalanceInsufficient
}
