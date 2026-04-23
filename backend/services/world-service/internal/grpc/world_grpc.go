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
	airportService    service.AirportService
	config            *config.Config
}

func NewWorldServer(countryService service.CountryService, regionService service.RegionService,
	regionLinkService service.RegionLinkService, airportService service.AirportService) *worldServer {
	config := config.InitConfig()

	return &worldServer{
		countryService: countryService, regionService: regionService,
		regionLinkService: regionLinkService, airportService: airportService, config: &config,
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

func (s *worldServer) ListCountries(ctx context.Context, _ *worldpb.ListCountriesRequest) (*worldpb.ListCountriesResponse, error) {
	return s.countryService.ListCountries(ctx)
}

// --- REGION ---
func (s *worldServer) CreateRegion(ctx context.Context, payload *worldpb.CreateRegionRequest) (*worldpb.IDResponse, error) {
	IDResponse, err := s.regionService.CreateRegion(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *worldServer) ListRegions(ctx context.Context, _ *worldpb.ListRegionsRequest) (*worldpb.ListRegionsResponse, error) {
	return s.regionService.ListRegions(ctx)
}

// --- REGION LINK ---
func (s *worldServer) CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (*worldpb.IDResponse, error) {
	IDResponse, err := s.regionLinkService.CreateRegionLink(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *worldServer) ListRegionLinks(ctx context.Context, _ *worldpb.ListRegionLinksRequest) (*worldpb.ListRegionLinksResponse, error) {
	return s.regionLinkService.ListRegionLinks(ctx)
}

// --- AIRPORT ---
func (s *worldServer) CreateAirport(ctx context.Context, payload *worldpb.CreateAirportRequest) (*worldpb.IDResponse, error) {
	IDResponse, err := s.airportService.CreateAirport(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *worldServer) ListAirports(ctx context.Context, _ *worldpb.ListAirportsRequest) (*worldpb.ListAirportsResponse, error) {
	return s.airportService.ListAirports(ctx)
}
