package grpc

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/service"
	operationspb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/operations/v1"
)

type OperationsServer struct {
	operationspb.UnimplementedOperationsServiceServer
	countryService    service.CountryService
	regionService     service.RegionService
	regionLinkService service.RegionLinkService
	airportService    service.AirportService
	config            *config.Config
}

func NewOperationsServer(countryService service.CountryService, regionService service.RegionService,
	regionLinkService service.RegionLinkService, airportService service.AirportService) *OperationsServer {
	config := config.InitConfig()

	return &OperationsServer{
		countryService: countryService, regionService: regionService,
		regionLinkService: regionLinkService, airportService: airportService, config: &config,
	}
}

// --- COUNTRY ---
func (s *OperationsServer) CreateCountry(ctx context.Context, payload *operationspb.CreateCountryRequest) (*operationspb.IDResponse, error) {
	IDResponse, err := s.countryService.CreateCountry(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *OperationsServer) ChangeCountry(ctx context.Context, payload *operationspb.ChangeCountryRequest) (*operationspb.IDResponse, error) {
	IDResponse, err := s.countryService.ChangeCountry(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *OperationsServer) ListCountries(ctx context.Context, _ *operationspb.ListCountriesRequest) (*operationspb.ListCountriesResponse, error) {
	return s.countryService.ListCountries(ctx)
}

func (s *OperationsServer) DeleteCountry(ctx context.Context, payload *operationspb.DeleteCountryRequest) (*operationspb.IDResponse, error) {
	return s.countryService.DeleteCountry(ctx, payload.Id)
}

// --- REGION ---
func (s *OperationsServer) CreateRegion(ctx context.Context, payload *operationspb.CreateRegionRequest) (*operationspb.IDResponse, error) {
	IDResponse, err := s.regionService.CreateRegion(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *OperationsServer) ChangeRegion(ctx context.Context, payload *operationspb.ChangeRegionRequest) (*operationspb.IDResponse, error) {
	IDResponse, err := s.regionService.ChangeRegion(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *OperationsServer) ListRegions(ctx context.Context, _ *operationspb.ListRegionsRequest) (*operationspb.ListRegionsResponse, error) {
	return s.regionService.ListRegions(ctx)
}

func (s *OperationsServer) DeleteRegion(ctx context.Context, payload *operationspb.DeleteRegionRequest) (*operationspb.IDResponse, error) {
	return s.regionService.DeleteRegion(ctx, payload.Id)
}

// --- REGION LINK ---
func (s *OperationsServer) CreateRegionLink(ctx context.Context, payload *operationspb.CreateRegionLinkRequest) (*operationspb.IDResponse, error) {
	IDResponse, err := s.regionLinkService.CreateRegionLink(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *OperationsServer) ChangeRegionLink(ctx context.Context, payload *operationspb.ChangeRegionLinkRequest) (*operationspb.IDResponse, error) {
	IDResponse, err := s.regionLinkService.ChangeRegionLink(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *OperationsServer) ListRegionLinks(ctx context.Context, _ *operationspb.ListRegionLinksRequest) (*operationspb.ListRegionLinksResponse, error) {
	return s.regionLinkService.ListRegionLinks(ctx)
}

func (s *OperationsServer) DeleteRegionLink(ctx context.Context, payload *operationspb.DeleteRegionLinkRequest) (*operationspb.IDResponse, error) {
	return s.regionLinkService.DeleteRegionLink(ctx, payload.Id)
}

// --- AIRPORT ---
func (s *OperationsServer) CreateAirport(ctx context.Context, payload *operationspb.CreateAirportRequest) (*operationspb.IDResponse, error) {
	IDResponse, err := s.airportService.CreateAirport(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *OperationsServer) ChangeAirport(ctx context.Context, payload *operationspb.ChangeAirportRequest) (*operationspb.IDResponse, error) {
	IDResponse, err := s.airportService.ChangeAirport(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}

func (s *OperationsServer) ListAirports(ctx context.Context, _ *operationspb.ListAirportsRequest) (*operationspb.ListAirportsResponse, error) {
	return s.airportService.ListAirports(ctx)
}

func (s *OperationsServer) DeleteAirport(ctx context.Context, payload *operationspb.DeleteAirportRequest) (*operationspb.IDResponse, error) {
	return s.airportService.DeleteAirport(ctx, payload.Id)
}
