package repository

import "github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/db"

type FleetRepository interface{}

type fleetRepository struct {
	pool db.DBConn
}

func NewFleetRepository(pool db.DBConn) FleetRepository {
	return &fleetRepository{pool: pool}
}
