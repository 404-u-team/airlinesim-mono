package repository

import (
	"context"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/db"
)

type GameStateRepository interface {
	GetState(ctx context.Context) (time.Time, time.Time, error)
	SetLastProcessed15Min(ctx context.Context, newTime time.Time) error
	SetLastProcessed1Hour(ctx context.Context, newTime time.Time) error
}

type gameStateRepository struct {
	pool db.DBConn
}

func NewGameStateRepository(pool db.DBConn) GameStateRepository {
	return &gameStateRepository{pool: pool}
}

// returns last_processed_15_min, last_processed_1_hour and error
func (r *gameStateRepository) GetState(ctx context.Context) (time.Time, time.Time, error) {
	query := `
		SELECT last_processed_15_min, last_processed_1_hour
		FROM game_state
		WHERE id = 1;
	`

	var lastProccessed15Min time.Time
	var lastProccessed1Hour time.Time
	err := r.pool.QueryRow(ctx, query).Scan(&lastProccessed15Min, &lastProccessed1Hour)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	return lastProccessed15Min, lastProccessed1Hour, nil
}

func (r *gameStateRepository) SetLastProcessed15Min(ctx context.Context, newTime time.Time) error {
	query := `
		INSERT INTO game_state (id, last_processed_15_min, last_processed_1_hour)
		VALUES (1, $1, NULL)
		ON CONFLICT (id) DO UPDATE
		SET
			last_processed_15_min = $1
	`
	_, err := r.pool.Exec(ctx, query, newTime)
	if err != nil {
		return err
	}

	return nil
}

func (r *gameStateRepository) SetLastProcessed1Hour(ctx context.Context, newTime time.Time) error {
	query := `
		INSERT INTO game_state (id, last_processed_15_min, last_processed_1_hour)
		VALUES (1, NULL, $1)
		ON CONFLICT (id) DO UPDATE
		SET
			last_processed_1_hour = $1
	`
	_, err := r.pool.Exec(ctx, query, newTime)
	if err != nil {
		return err
	}

	return nil
}
