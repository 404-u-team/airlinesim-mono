package dto

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type AircraftManufacturer struct {
	ID                      uuid.UUID
	Name                    string
	LogoUploadID            *uuid.UUID
	MarketName              string
	ProductionPointsPerWeek float64
}

type AircraftType struct {
	ID                      uuid.UUID
	ManufacturerID          uuid.UUID
	ModelName               string
	IcaoCode                string
	IataCode                string
	ImageUploadID           *uuid.UUID
	MaxRangeKm              float64
	CruisingSpeedKph        float64
	MaxPlannedSeatCapacity  float64
	MinRunwayLengthM        float64
	ProductionPointsPrice   float64
	BaseTurnaroundPoints    float64
	BaseMaintenancePoints   float64
	MaintCostPerTakeoff     float64
	MaintCostPerLanding     float64
	MaintCostPerFlightHour  float64
	DCheckIntervalFH        float64
	DCheckIntervalYears     float64
	DCheckOverdueMultiplier float64
	FuelConsumptionPerHour  float64
	MTOWKG                  float64
	PricePerUnit            float64
	Characteristics         json.RawMessage
}

type Aircraft struct {
	ID                         uuid.UUID
	TypeID                     uuid.UUID
	CurrentOwnerID             *uuid.UUID
	BaseAirportID              *uuid.UUID
	TailNumber                 string
	InService                  bool
	Status                     string
	CurrentMaintenancePoints   float64
	MaxMaintenancePointsCached float64
	TotalFlightHours           float64
	FHSinceLastDCheck          float64
	TotalCycles                float64
	ManufacturedAt             *time.Time
}

type AircraftSeat struct {
	ID            uuid.UUID
	AircraftID    uuid.UUID
	TariffClassID uuid.UUID
	Count         float64
}

type AircraftModifier struct {
	ID                               uuid.UUID
	Name                             string
	Description                      *string
	InstallCost                      float64
	ExtraRevenuePerPax               *float64
	SeatsEquivalent                  *float64
	MaxMaintenancePointsDelta        *float64
	MaintenanceConsumptionMultiplier *float64
	MaintenancePointsPerFlightDelta  *float64
	TurnaroundPointsDelta            *float64
	OtherEffects                     json.RawMessage
}

type AircraftModifierInstance struct {
	ID          uuid.UUID
	AircraftID  uuid.UUID
	ModifierID  uuid.UUID
	InstalledAt time.Time
}

type AircraftOrder struct {
	ID               uuid.UUID
	AirlineID        uuid.UUID
	ManufacturerID   uuid.UUID
	AircraftTypeID   uuid.UUID
	Count            float64
	ProductionPoints float64
	Configuration    json.RawMessage
	Status           string
	CreatedAt        time.Time
}

type MaintenanceRecord struct {
	ID             uuid.UUID
	AircraftID     uuid.UUID
	FacilityID     *uuid.UUID
	AirportID      uuid.UUID
	CheckType      string
	Cost           float64
	PointsRestored float64
	StartedAt      time.Time
	CompletedAt    *time.Time
	Status         string
}
