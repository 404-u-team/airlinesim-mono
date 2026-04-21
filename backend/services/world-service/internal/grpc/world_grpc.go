package grpc

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/service"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
)

type worldServer struct {
	worldpb.UnimplementedWorldServiceServer
	countryService    service.CountryService
	regionService     service.RegionService
	regionLinkService service.RegionLinkService
	config            *config.Config
}

func NewWorldServer(countryService service.CountryService, regionService service.RegionService,
	regionLinkService service.RegionLinkService) *worldServer {
	config := config.InitConfig()

	return &worldServer{
		countryService: countryService, regionService: regionService,
		regionLinkService: regionLinkService, config: &config,
	}
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

// --- REGION LINK ---
func (s *worldServer) CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (*worldpb.IDResponse, error) {
	IDResponse, err := s.regionLinkService.CreateRegionLink(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}
