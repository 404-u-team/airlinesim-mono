package service

import (
	"context"
	"errors"
	"fmt"

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
