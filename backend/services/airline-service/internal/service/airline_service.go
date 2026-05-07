package service

import (
	"context"
	"fmt"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/config"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/grpc"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/utils"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/google/uuid"
)

type AirlineService interface {
}

type airlineService struct {
	config          config.Config
	airlineRepo     repository.AirlineRepository
	airportViewRepo repository.AirportViewRepository
	authClient      grpcclient.AuthClient
}

func NewAirlineService(
	config config.Config, airlineRepo repository.AirlineRepository, airportViewRepo repository.AirportViewRepository,
	authClient grpcclient.AuthClient,
) AirlineService {

	return airlineService{
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

	// get game time
	currentGameTime := utils.CurrentGameTime(s.config)

	// create airline
	airlineID, err := s.airlineRepo.CreateAirline(ctx, payload, currentGameTime)
	if err != nil {
		return nil, fmt.Errorf("got error when tried to create airline")
	}

	createAirlineResponse := airlinepb.CreateAirlineResponse{Id: airlineID.String()}
	return &createAirlineResponse, nil
}
