package grpcserver

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/service"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
)

type airlineServer struct {
	airlinepb.UnimplementedAirlineServiceServer
	airlineService service.AirlineService
}

func NewAirlineServer(airlineService service.AirlineService) *airlineServer {
	return &airlineServer{airlineService: airlineService}
}

func (s *airlineServer) CreateAirline(ctx context.Context, payload *airlinepb.CreateAirlineRequest) (*airlinepb.CreateAirlineResponse, error) {
	tokenResponse, err := s.airlineService.CreateAirline(ctx, payload)
	if err != nil {
		return nil, err
	}

	return tokenResponse, nil
}

func (s *airlineServer) AdjustBalance(ctx context.Context, payload *airlinepb.AdjustBalanceRequest) (*airlinepb.AdjustBalanceResponse, error) {
	response, err := s.airlineService.AdjustBalance(ctx, payload)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (s *airlineServer) GetAirlineByID(ctx context.Context, payload *airlinepb.GetAirlineByIDRequest) (*airlinepb.AirlineResponse, error) {
	response, err := s.airlineService.GetAirlineByID(ctx, payload)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (s *airlineServer) GetAirlineByOwnerID(ctx context.Context, payload *airlinepb.GetAirlineByOwnerIDRequest) (*airlinepb.AirlineResponse, error) {
	response, err := s.airlineService.GetAirlineByOwnerID(ctx, payload)
	if err != nil {
		return nil, err
	}

	return response, nil
}
