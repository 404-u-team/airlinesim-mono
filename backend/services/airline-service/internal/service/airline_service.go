package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/grpcclient"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/repository"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type AirlineService interface {
	CreateAirline(ctx context.Context, payload *airlinepb.CreateAirlineRequest) (*airlinepb.CreateAirlineResponse, error)
	AdjustBalance(ctx context.Context, payload *airlinepb.AdjustBalanceRequest) (*airlinepb.AdjustBalanceResponse, error)
}

type airlineService struct {
	config          *config.Config
	airlineRepo     repository.AirlineRepository
	airportViewRepo repository.AirportViewRepository
	authClient      grpcclient.AuthClient
}

func NewAirlineService(
	config *config.Config, airlineRepo repository.AirlineRepository, airportViewRepo repository.AirportViewRepository,
	authClient grpcclient.AuthClient,
) AirlineService {

	return &airlineService{
		config: config, airlineRepo: airlineRepo,
		airportViewRepo: airportViewRepo,
		authClient:      authClient,
	}
}

func (s *airlineService) CreateAirline(ctx context.Context, payload *airlinepb.CreateAirlineRequest) (*airlinepb.CreateAirlineResponse, error) {
	// check airport existance in view table
	airportID, err := uuid.Parse(payload.StartingAirportId)
	if err != nil {
		return nil, fmt.Errorf("got error when tried to convert to uuid starting airport, %w", err)
	}

	exists, err := s.airportViewRepo.IsAirportExists(ctx, airportID)
	if err != nil {
		return nil, fmt.Errorf("got error when tried to check airport existence, %w", err)
	}
	if !exists {
		return nil, customerrors.ErrAirportNotFound
	}

	// check user existance in auth service
	userID, err := uuid.Parse(payload.OwnerId)
	if err != nil {
		return nil, fmt.Errorf("got error when tried to convert user id to uuid, %w", err)
	}

	verifyUserRequest := authpb.VerifyUserRequest{UserId: userID.String()}

	existanceResponse, err := s.authClient.VerifyUser(ctx, &verifyUserRequest)
	if err != nil {
		return nil, fmt.Errorf("got error when tried to verify user through auth client")
	}
	if !existanceResponse.Valid {
		return nil, customerrors.ErrUserNotFound
	}

	// create airline
	airlineID, balance, err := s.airlineRepo.CreateAirline(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			// unique constraint violation
			if pgErr.ConstraintName == "airlines_owner_id_key" {
				return nil, customerrors.ErrAirlineWithSuchOwnerExists
			}
			if pgErr.ConstraintName == "airlines_name_key" {
				return nil, customerrors.ErrAirlineNameConflict
			}
			if pgErr.ConstraintName == "airlines_iata_code_key" {
				return nil, customerrors.ErrAirlineIataConflict
			}
			if pgErr.ConstraintName == "airlines_icao_code_key" {
				return nil, customerrors.ErrAirlineIcaoConflict
			}
		}
		return nil, fmt.Errorf("got error when tried to create airline, %w", err)
	}

	createAirlineResponse := airlinepb.CreateAirlineResponse{Id: airlineID.String(), Balance: balance}
	return &createAirlineResponse, nil
}

func (s *airlineService) AdjustBalance(ctx context.Context, payload *airlinepb.AdjustBalanceRequest) (*airlinepb.AdjustBalanceResponse, error) {
	ownerID, err := uuid.Parse(payload.OwnerId)
	if err != nil {
		return nil, fmt.Errorf("got error when tried to convert owner id to uuid, %w", err)
	}

	airlineID, balance, err := s.airlineRepo.AdjustBalance(ctx, ownerID, payload.Amount)
	if err != nil {
		return nil, err
	}

	return &airlinepb.AdjustBalanceResponse{AirlineId: airlineID.String(), Balance: balance}, nil
}
