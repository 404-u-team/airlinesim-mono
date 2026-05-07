package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/db"
	"github.com/google/uuid"
)

type AirportViewRepository interface {
	IsAirportExists(ctx context.Context, airportID uuid.UUID) (bool, error)
}

type airportViewRepository struct {
	pool db.DBConn
}

func NewAirportViewRepository(pool db.DBConn) AirportViewRepository {
	return &airportViewRepository{pool: pool}
}

func (r *airportViewRepository) IsAirportExists(ctx context.Context, airportID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1
			FROM airport_view WHERE id=$1
		)
	`
	var exists bool
	err := r.pool.QueryRow(ctx, query, airportID).
		Scan(&exists)

	return exists, err
}
