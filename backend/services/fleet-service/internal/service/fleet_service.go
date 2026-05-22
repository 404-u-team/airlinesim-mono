package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	grpcclient "github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/grpcclient"
	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/repository"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	fleetpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/fleet/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type FleetService interface {
	CreateAircraft(ctx context.Context, payload *fleetpb.CreateAircraftRequest) (*fleetpb.CreateAircraftResponse, error)
	CreateAircraftType(ctx context.Context, payload *fleetpb.CreateAircraftTypeRequest) (*fleetpb.AircraftType, error)
	ListAircraftTypes(ctx context.Context) (*fleetpb.ListAircraftTypesResponse, error)
	GetAircraftType(ctx context.Context, id string) (*fleetpb.AircraftType, error)
	ListAircrafts(ctx context.Context, ownerID string) (*fleetpb.ListAircraftsResponse, error)
}

type fleetService struct {
	repo          repository.FleetRepository
	airlineClient *grpcclient.AirlineClient
}

func NewFleetService(repo repository.FleetRepository, airlineClient *grpcclient.AirlineClient) FleetService {
	return &fleetService{repo: repo, airlineClient: airlineClient}
}

func (s *fleetService) CreateAircraft(ctx context.Context, payload *fleetpb.CreateAircraftRequest) (*fleetpb.CreateAircraftResponse, error) {
	typeID, err := uuid.Parse(payload.AircraftTypeId)
	if err != nil {
		return nil, customerrors.ErrAircraftTypeNotFound
	}

	pricePerUnit, err := s.repo.GetAircraftTypePrice(ctx, typeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, customerrors.ErrAircraftTypeNotFound
		}
		return nil, fmt.Errorf("got error when tried to get aircraft type price, %w", err)
	}

	ownerBalanceResponse, err := s.airlineClient.AdjustBalance(ctx, &airlinepb.AdjustBalanceRequest{
		OwnerId: payload.CurrentOwnerId,
		Amount:  -pricePerUnit,
	})
	if err != nil {
		if errors.Is(err, customerrors.ErrAirlineNotFound) {
			return nil, customerrors.ErrAirlineNotFound
		}
		if errors.Is(err, customerrors.ErrAirlineBalanceInsufficient) {
			return nil, customerrors.ErrAirlineBalanceInsufficient
		}
		return nil, fmt.Errorf("got error when tried to charge airline balance, %w", err)
	}

	aircraftID, err := s.repo.CreateAircraft(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.ConstraintName {
			case "aircraft_tail_number_key":
				_, _ = s.airlineClient.AdjustBalance(ctx, &airlinepb.AdjustBalanceRequest{OwnerId: payload.CurrentOwnerId, Amount: pricePerUnit})
				return nil, customerrors.ErrAircraftTailNumberConflict
			}
			if pgErr.Code == "23505" {
				_, _ = s.airlineClient.AdjustBalance(ctx, &airlinepb.AdjustBalanceRequest{OwnerId: payload.CurrentOwnerId, Amount: pricePerUnit})
				return nil, customerrors.ErrInternal
			}
			if pgErr.Code == "23503" {
				_, _ = s.airlineClient.AdjustBalance(ctx, &airlinepb.AdjustBalanceRequest{OwnerId: payload.CurrentOwnerId, Amount: pricePerUnit})
				return nil, customerrors.ErrAircraftTypeNotFound
			}
		}
		if errors.Is(err, pgx.ErrNoRows) {
			_, _ = s.airlineClient.AdjustBalance(ctx, &airlinepb.AdjustBalanceRequest{OwnerId: payload.CurrentOwnerId, Amount: pricePerUnit})
			return nil, customerrors.ErrAircraftTypeNotFound
		}
		_, _ = s.airlineClient.AdjustBalance(ctx, &airlinepb.AdjustBalanceRequest{OwnerId: payload.CurrentOwnerId, Amount: pricePerUnit})
		return nil, fmt.Errorf("got error when tried to create aircraft, %w", err)
	}

	_ = ownerBalanceResponse

	return &fleetpb.CreateAircraftResponse{Id: aircraftID.String()}, nil
}

func (s *fleetService) ListAircraftTypes(ctx context.Context) (*fleetpb.ListAircraftTypesResponse, error) {
	types, err := s.repo.ListAircraftTypes(ctx)
	if err != nil {
		return nil, err
	}

	var items []*fleetpb.AircraftType
	for _, t := range types {
		var imageID string
		if t.ImageUploadID != nil {
			imageID = t.ImageUploadID.String()
		}

		items = append(items, &fleetpb.AircraftType{
			Id:                      t.ID.String(),
			ManufacturerId:          t.ManufacturerID.String(),
			ModelName:               t.ModelName,
			IcaoCode:                t.IcaoCode,
			IataCode:                t.IataCode,
			ImageUploadId:           imageID,
			MaxRangeKm:              t.MaxRangeKm,
			CruisingSpeedKph:        t.CruisingSpeedKph,
			MaxPlannedSeatCapacity:  t.MaxPlannedSeatCapacity,
			MinRunwayLengthM:        t.MinRunwayLengthM,
			ProductionPointsPrice:   t.ProductionPointsPrice,
			BaseTurnaroundPoints:    t.BaseTurnaroundPoints,
			BaseMaintenancePoints:   t.BaseMaintenancePoints,
			MaintCostPerTakeoff:     t.MaintCostPerTakeoff,
			MaintCostPerLanding:     t.MaintCostPerLanding,
			MaintCostPerFlightHour:  t.MaintCostPerFlightHour,
			DCheckIntervalFh:        t.DCheckIntervalFH,
			DCheckIntervalYears:     t.DCheckIntervalYears,
			DCheckOverdueMultiplier: t.DCheckOverdueMultiplier,
			FuelConsumptionPerHour:  t.FuelConsumptionPerHour,
			MtowKg:                  t.MTOWKG,
			PricePerUnit:            t.PricePerUnit,
			Characteristics:         string(t.Characteristics),
		})
	}

	return &fleetpb.ListAircraftTypesResponse{Items: items}, nil
}

func (s *fleetService) GetAircraftType(ctx context.Context, id string) (*fleetpb.AircraftType, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return nil, customerrors.ErrAircraftTypeNotFound
	}

	t, err := s.repo.GetAircraftTypeByID(ctx, uid)
	if err != nil {
		return nil, err
	}

	var imageID string
	if t.ImageUploadID != nil {
		imageID = t.ImageUploadID.String()
	}

	return &fleetpb.AircraftType{
		Id:                      t.ID.String(),
		ManufacturerId:          t.ManufacturerID.String(),
		ModelName:               t.ModelName,
		IcaoCode:                t.IcaoCode,
		IataCode:                t.IataCode,
		ImageUploadId:           imageID,
		MaxRangeKm:              t.MaxRangeKm,
		CruisingSpeedKph:        t.CruisingSpeedKph,
		MaxPlannedSeatCapacity:  t.MaxPlannedSeatCapacity,
		MinRunwayLengthM:        t.MinRunwayLengthM,
		ProductionPointsPrice:   t.ProductionPointsPrice,
		BaseTurnaroundPoints:    t.BaseTurnaroundPoints,
		BaseMaintenancePoints:   t.BaseMaintenancePoints,
		MaintCostPerTakeoff:     t.MaintCostPerTakeoff,
		MaintCostPerLanding:     t.MaintCostPerLanding,
		MaintCostPerFlightHour:  t.MaintCostPerFlightHour,
		DCheckIntervalFh:        t.DCheckIntervalFH,
		DCheckIntervalYears:     t.DCheckIntervalYears,
		DCheckOverdueMultiplier: t.DCheckOverdueMultiplier,
		FuelConsumptionPerHour:  t.FuelConsumptionPerHour,
		MtowKg:                  t.MTOWKG,
		PricePerUnit:            t.PricePerUnit,
		Characteristics:         string(t.Characteristics),
	}, nil
}

func (s *fleetService) CreateAircraftType(ctx context.Context, payload *fleetpb.CreateAircraftTypeRequest) (*fleetpb.AircraftType, error) {
	created, err := s.repo.CreateAircraftType(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.Code == "23505" {
				return nil, customerrors.ErrInternal
			}
			if pgErr.Code == "23503" {
				return nil, customerrors.ErrInternal
			}
		}
		return nil, err
	}

	var imageID string
	if created.ImageUploadID != nil {
		imageID = created.ImageUploadID.String()
	}

	return &fleetpb.AircraftType{
		Id:                      created.ID.String(),
		ManufacturerId:          created.ManufacturerID.String(),
		ModelName:               created.ModelName,
		IcaoCode:                created.IcaoCode,
		IataCode:                created.IataCode,
		ImageUploadId:           imageID,
		MaxRangeKm:              created.MaxRangeKm,
		CruisingSpeedKph:        created.CruisingSpeedKph,
		MaxPlannedSeatCapacity:  created.MaxPlannedSeatCapacity,
		MinRunwayLengthM:        created.MinRunwayLengthM,
		ProductionPointsPrice:   created.ProductionPointsPrice,
		BaseTurnaroundPoints:    created.BaseTurnaroundPoints,
		BaseMaintenancePoints:   created.BaseMaintenancePoints,
		MaintCostPerTakeoff:     created.MaintCostPerTakeoff,
		MaintCostPerLanding:     created.MaintCostPerLanding,
		MaintCostPerFlightHour:  created.MaintCostPerFlightHour,
		DCheckIntervalFh:        created.DCheckIntervalFH,
		DCheckIntervalYears:     created.DCheckIntervalYears,
		DCheckOverdueMultiplier: created.DCheckOverdueMultiplier,
		FuelConsumptionPerHour:  created.FuelConsumptionPerHour,
		MtowKg:                  created.MTOWKG,
		PricePerUnit:            created.PricePerUnit,
		Characteristics:         string(created.Characteristics),
	}, nil
}

func (s *fleetService) ListAircrafts(ctx context.Context, ownerID string) (*fleetpb.ListAircraftsResponse, error) {
	uid, err := uuid.Parse(ownerID)
	if err != nil {
		return nil, customerrors.ErrAircraftTypeNotFound
	}

	items, err := s.repo.ListAircraftsByOwner(ctx, uid)
	if err != nil {
		return nil, err
	}

	var res []*fleetpb.Aircraft
	for _, a := range items {
		var currentOwnerId string
		if a.CurrentOwnerID != nil {
			currentOwnerId = a.CurrentOwnerID.String()
		}
		var baseAirportId string
		if a.BaseAirportID != nil {
			baseAirportId = a.BaseAirportID.String()
		}
		var manufacturedAt string
		if a.ManufacturedAt != nil {
			manufacturedAt = a.ManufacturedAt.Format(time.RFC3339)
		}
		res = append(res, &fleetpb.Aircraft{
			Id:                         a.ID.String(),
			TypeId:                     a.TypeID.String(),
			CurrentOwnerId:             currentOwnerId,
			BaseAirportId:              baseAirportId,
			TailNumber:                 a.TailNumber,
			InService:                  a.InService,
			Status:                     a.Status,
			CurrentMaintenancePoints:   a.CurrentMaintenancePoints,
			MaxMaintenancePointsCached: a.MaxMaintenancePointsCached,
			TotalFlightHours:           a.TotalFlightHours,
			FhSinceLastDCheck:          a.FHSinceLastDCheck,
			TotalCycles:                a.TotalCycles,
			ManufacturedAt:             manufacturedAt,
		})
	}

	return &fleetpb.ListAircraftsResponse{Items: res}, nil
}
