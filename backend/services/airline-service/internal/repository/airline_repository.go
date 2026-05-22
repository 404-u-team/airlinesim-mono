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
	GetAirlineByID(ctx context.Context, id uuid.UUID) (*airlinepb.AirlineResponse, error)
	GetAirlineByOwnerID(ctx context.Context, ownerID uuid.UUID) (*airlinepb.AirlineResponse, error)
	UpdateAirline(ctx context.Context, id uuid.UUID, name, iataCode, icaoCode string) error
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

func (r *airlineRepository) GetAirlineByID(ctx context.Context, id uuid.UUID) (*airlinepb.AirlineResponse, error) {
	return r.getAirline(ctx, `WHERE id = $1`, id)
}

func (r *airlineRepository) GetAirlineByOwnerID(ctx context.Context, ownerID uuid.UUID) (*airlinepb.AirlineResponse, error) {
	return r.getAirline(ctx, `WHERE owner_id = $1`, ownerID)
}

func (r *airlineRepository) getAirline(ctx context.Context, clause string, id uuid.UUID) (*airlinepb.AirlineResponse, error) {
	query := `
		SELECT
			id::text,
			owner_id::text,
			starting_airport_id::text,
			name,
			iata_code,
			substring(icao_code from 1 for 3),
			balance,
			COALESCE(equity_cached, 0),
			COALESCE(equity_cached_at::text, ''),
			credit_rating,
			safety_rating,
			reputation,
			is_public,
			is_bankrupt,
			created_at::text
		FROM airline
		` + clause + `
	`

	var airline airlinepb.AirlineResponse
	var equityCachedAt string
	if err := r.pool.QueryRow(ctx, query, id).Scan(
		&airline.Id,
		&airline.OwnerId,
		&airline.StartingAirportId,
		&airline.Name,
		&airline.IataCode,
		&airline.IcaoCode,
		&airline.Balance,
		&airline.EquityCached,
		&equityCachedAt,
		&airline.CreditRating,
		&airline.SafetyRating,
		&airline.Reputation,
		&airline.IsPublic,
		&airline.IsBankrupt,
		&airline.CreatedAt,
	); err != nil {
		return nil, err
	}

	airline.EquityCachedAt = equityCachedAt
	return &airline, nil
}

func (r *airlineRepository) UpdateAirline(ctx context.Context, id uuid.UUID, name, iataCode, icaoCode string) error {
	query := `
		UPDATE airline
		SET name = $2,
			iata_code = $3,
			icao_code = $4
		WHERE id = $1
	`

	_, err := r.pool.Exec(ctx, query, id, name, iataCode, icaoCode)
	return err
}
