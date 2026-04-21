package grpc

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/service"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
)

type worldServer struct {
	worldpb.UnimplementedWorldServiceServer
	countryService service.CountryService
	regionService  service.RegionService
	config         *config.Config
}

func NewWorldServer(countryService service.CountryService) *worldServer {
	config := config.InitConfig()
	return &worldServer{countryService: countryService, config: &config}
}

// --- COUNTRY ---
func (s *worldServer) CreateCountry(ctx context.Context, payload *worldpb.CreateCountryRequest) (*worldpb.IDResponse, error) {
	IDResponse, err := s.countryService.CreateCountry(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

// --- REGION ---
func (s *worldServer) CreateRegion(ctx context.Context, payload *worldpb.CreateRegionRequest) (*worldpb.IDResponse, error) {
	IDResponse, err := s.regionService.CreateRegion(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}
