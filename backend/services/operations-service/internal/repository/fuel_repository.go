package repository

import (
	"context"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/db"
)

type FuelRepository interface {
	SetNewFuelPrice(ctx context.Context, price float64) (time.Time, error)
}

type fuelRepository struct {
	pool db.DBConn
}

func NewFuelRepository(pool db.DBConn) FuelRepository {
	return &fuelRepository{pool: pool}
}

// returns recorded_at and error
func (r *fuelRepository) SetNewFuelPrice(ctx context.Context, price float64) (time.Time, error) {
	query := `
        INSERT INTO global_fuel_price (price)
        VALUES ($1)
		RETURNING recorded_at; 
    `

	var recordedAt time.Time
	err := r.pool.QueryRow(ctx, query, price).Scan(&recordedAt)
	if err != nil {
		return time.Time{}, err
	}

	return recordedAt, nil
}
