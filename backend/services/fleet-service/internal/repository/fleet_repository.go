package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/dto"
	fleetpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/fleet/v1"
	"github.com/google/uuid"
)

type FleetRepository interface {
	CreateAircraft(ctx context.Context, payload *fleetpb.CreateAircraftRequest) (uuid.UUID, error)
	CreateAircraftType(ctx context.Context, payload *fleetpb.CreateAircraftTypeRequest) (dto.AircraftType, error)
	GetAircraftTypePrice(ctx context.Context, aircraftTypeID uuid.UUID) (float64, error)
	ListAircraftTypes(ctx context.Context) ([]dto.AircraftType, error)
	GetAircraftTypeByID(ctx context.Context, id uuid.UUID) (*dto.AircraftType, error)
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

func (r *fleetRepository) ListAircraftTypes(ctx context.Context) ([]dto.AircraftType, error) {
	query := `SELECT
		at.id, at.manufacturer_id, at.model_name, at.icao_code, at.iata_code, at.image_upload_id,
		at.max_range_km, at.cruising_speed_kph, at.max_planned_seat_capacity, at.min_runway_length_m,
		at.production_points_price, at.base_turnaround_points, at.base_maintenance_points,
		at.maint_cost_per_takeoff, at.maint_cost_per_landing, at.maint_cost_per_flight_hour,
		at.d_check_interval_fh, at.d_check_interval_years, at.d_check_overdue_multiplier,
		at.fuel_consumption_per_hour, at.mtow_kg, at.price_per_unit, at.characteristics
	FROM aircraft_type at
	ORDER BY at.model_name ASC`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []dto.AircraftType
	for rows.Next() {
		var a dto.AircraftType
		var imageUploadID *uuid.UUID
		var characteristics []byte
		err = rows.Scan(&a.ID, &a.ManufacturerID, &a.ModelName, &a.IcaoCode, &a.IataCode, &imageUploadID,
			&a.MaxRangeKm, &a.CruisingSpeedKph, &a.MaxPlannedSeatCapacity, &a.MinRunwayLengthM,
			&a.ProductionPointsPrice, &a.BaseTurnaroundPoints, &a.BaseMaintenancePoints,
			&a.MaintCostPerTakeoff, &a.MaintCostPerLanding, &a.MaintCostPerFlightHour,
			&a.DCheckIntervalFH, &a.DCheckIntervalYears, &a.DCheckOverdueMultiplier,
			&a.FuelConsumptionPerHour, &a.MTOWKG, &a.PricePerUnit, &characteristics)
		if err != nil {
			return nil, err
		}
		a.ImageUploadID = imageUploadID
		a.Characteristics = characteristics
		res = append(res, a)
	}

	return res, nil
}

func (r *fleetRepository) GetAircraftTypeByID(ctx context.Context, id uuid.UUID) (*dto.AircraftType, error) {
	query := `SELECT
		at.id, at.manufacturer_id, at.model_name, at.icao_code, at.iata_code, at.image_upload_id,
		at.max_range_km, at.cruising_speed_kph, at.max_planned_seat_capacity, at.min_runway_length_m,
		at.production_points_price, at.base_turnaround_points, at.base_maintenance_points,
		at.maint_cost_per_takeoff, at.maint_cost_per_landing, at.maint_cost_per_flight_hour,
		at.d_check_interval_fh, at.d_check_interval_years, at.d_check_overdue_multiplier,
		at.fuel_consumption_per_hour, at.mtow_kg, at.price_per_unit, at.characteristics
	FROM aircraft_type at
	WHERE at.id = $1 LIMIT 1`

	row := r.pool.QueryRow(ctx, query, id)
	var a dto.AircraftType
	var imageUploadID *uuid.UUID
	var characteristics []byte
	err := row.Scan(&a.ID, &a.ManufacturerID, &a.ModelName, &a.IcaoCode, &a.IataCode, &imageUploadID,
		&a.MaxRangeKm, &a.CruisingSpeedKph, &a.MaxPlannedSeatCapacity, &a.MinRunwayLengthM,
		&a.ProductionPointsPrice, &a.BaseTurnaroundPoints, &a.BaseMaintenancePoints,
		&a.MaintCostPerTakeoff, &a.MaintCostPerLanding, &a.MaintCostPerFlightHour,
		&a.DCheckIntervalFH, &a.DCheckIntervalYears, &a.DCheckOverdueMultiplier,
		&a.FuelConsumptionPerHour, &a.MTOWKG, &a.PricePerUnit, &characteristics)
	if err != nil {
		return nil, err
	}
	a.ImageUploadID = imageUploadID
	a.Characteristics = characteristics
	return &a, nil
}

func (r *fleetRepository) CreateAircraftType(ctx context.Context, payload *fleetpb.CreateAircraftTypeRequest) (dto.AircraftType, error) {
	query := `INSERT INTO aircraft_type (
		manufacturer_id, model_name, icao_code, iata_code, image_upload_id,
		max_range_km, cruising_speed_kph, max_planned_seat_capacity, min_runway_length_m,
		production_points_price, base_turnaround_points, base_maintenance_points,
		maint_cost_per_takeoff, maint_cost_per_landing, maint_cost_per_flight_hour,
		d_check_interval_fh, d_check_interval_years, d_check_overdue_multiplier,
		fuel_consumption_per_hour, mtow_kg, price_per_unit, characteristics
	) VALUES (
		NULLIF($1, '')::uuid, $2, $3, $4, NULLIF($5, '')::uuid,
		$6, $7, $8, $9,
		$10, $11, $12,
		$13, $14, $15,
		$16, $17, $18,
		$19, $20, $21, $22
	) RETURNING id, manufacturer_id, model_name, icao_code, iata_code, image_upload_id,
		max_range_km, cruising_speed_kph, max_planned_seat_capacity, min_runway_length_m,
		production_points_price, base_turnaround_points, base_maintenance_points,
		maint_cost_per_takeoff, maint_cost_per_landing, maint_cost_per_flight_hour,
		d_check_interval_fh, d_check_interval_years, d_check_overdue_multiplier,
		fuel_consumption_per_hour, mtow_kg, price_per_unit, characteristics`

	var a dto.AircraftType
	var imageUploadID *uuid.UUID
	var characteristics []byte

	err := r.pool.QueryRow(ctx, query,
		payload.ManufacturerId, payload.ModelName, payload.IcaoCode, payload.IataCode, payload.ImageUploadId,
		payload.MaxRangeKm, payload.CruisingSpeedKph, payload.MaxPlannedSeatCapacity, payload.MinRunwayLengthM,
		payload.ProductionPointsPrice, payload.BaseTurnaroundPoints, payload.BaseMaintenancePoints,
		payload.MaintCostPerTakeoff, payload.MaintCostPerLanding, payload.MaintCostPerFlightHour,
		payload.DCheckIntervalFh, payload.DCheckIntervalYears, payload.DCheckOverdueMultiplier,
		payload.FuelConsumptionPerHour, payload.MtowKg, payload.PricePerUnit, payload.Characteristics,
	).Scan(&a.ID, &a.ManufacturerID, &a.ModelName, &a.IcaoCode, &a.IataCode, &imageUploadID,
		&a.MaxRangeKm, &a.CruisingSpeedKph, &a.MaxPlannedSeatCapacity, &a.MinRunwayLengthM,
		&a.ProductionPointsPrice, &a.BaseTurnaroundPoints, &a.BaseMaintenancePoints,
		&a.MaintCostPerTakeoff, &a.MaintCostPerLanding, &a.MaintCostPerFlightHour,
		&a.DCheckIntervalFH, &a.DCheckIntervalYears, &a.DCheckOverdueMultiplier,
		&a.FuelConsumptionPerHour, &a.MTOWKG, &a.PricePerUnit, &characteristics)
	if err != nil {
		return dto.AircraftType{}, err
	}
	a.ImageUploadID = imageUploadID
	a.Characteristics = characteristics
	return a, nil
}
