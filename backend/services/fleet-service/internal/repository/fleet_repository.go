package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/db"
	fleetpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/fleet/v1"
	"github.com/google/uuid"
)

type FleetRepository interface {
	CreateAircraft(ctx context.Context, payload *fleetpb.CreateAircraftRequest) (uuid.UUID, error)
	GetAircraftTypePrice(ctx context.Context, aircraftTypeID uuid.UUID) (float64, error)
}

type fleetRepository struct {
	pool db.DBConn
}

func NewFleetRepository(pool db.DBConn) FleetRepository {
	return &fleetRepository{pool: pool}
}

func (r *fleetRepository) CreateAircraft(ctx context.Context, payload *fleetpb.CreateAircraftRequest) (uuid.UUID, error) {
	query := `
		INSERT INTO aircraft (
			type_id, current_owner_id, base_airport_id, tail_number,
			in_service, status, current_maintenance_points,
			max_maintenance_points_cached, total_flight_hours,
			fh_since_last_d_check, total_cycles, manufactured_at
		)
		SELECT
			$1,
			NULLIF($4, '')::uuid,
			NULLIF($2, '')::uuid,
			$3,
			TRUE,
			'idle',
			0,
			aircraft_type.base_maintenance_points,
			0,
			0,
			0,
			NOW()
		FROM aircraft_type
		WHERE id = $1
		RETURNING id
	`

	typeID, err := uuid.Parse(payload.AircraftTypeId)
	if err != nil {
		return uuid.Nil, err
	}

	var aircraftID uuid.UUID
	err = r.pool.QueryRow(ctx, query, typeID, payload.BaseAirportId, payload.TailNumber, payload.CurrentOwnerId).Scan(&aircraftID)
	if err != nil {
		return uuid.Nil, err
	}

	return aircraftID, nil
}

func (r *fleetRepository) GetAircraftTypePrice(ctx context.Context, aircraftTypeID uuid.UUID) (float64, error) {
	var price float64
	err := r.pool.QueryRow(ctx, `SELECT price_per_unit FROM aircraft_type WHERE id = $1`, aircraftTypeID).Scan(&price)
	if err != nil {
		return 0, err
	}

	return price, nil
}
