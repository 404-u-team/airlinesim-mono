package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/db"
	"github.com/google/uuid"
)

type AirportViewRepository interface {
	IsAirportExists(ctx context.Context, airportID uuid.UUID) (bool, error)
	CreateAirportView(ctx context.Context, airportID uuid.UUID) error
	DeleteAirportView(ctx context.Context, airportID uuid.UUID) error
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

func (r *airportViewRepository) CreateAirportView(ctx context.Context, airportID uuid.UUID) error {
	query := `
		INSERT INTO airport_view (id)
		VALUES ($1)
		ON CONFLICT (id) DO NOTHING
	`
	_, err := r.pool.Exec(ctx, query, airportID)
	return err
}

func (r *airportViewRepository) DeleteAirportView(ctx context.Context, airportID uuid.UUID) error {
	query := `
		DELETE FROM airport_view 
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, airportID)
	return err
}
