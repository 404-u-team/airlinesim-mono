package grpcserver

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/service"
	fleetpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/fleet/v1"
	"google.golang.org/protobuf/types/known/emptypb"
)

type FleetServer struct {
	fleetpb.UnimplementedFleetServiceServer
	fleetService service.FleetService
}

func NewFleetServer(fleetService service.FleetService) *FleetServer {
	return &FleetServer{fleetService: fleetService}
}

func (s *FleetServer) CreateAircraft(ctx context.Context, payload *fleetpb.CreateAircraftRequest) (*fleetpb.CreateAircraftResponse, error) {
	return s.fleetService.CreateAircraft(ctx, payload)
}

func (s *FleetServer) CreateAircraftType(ctx context.Context, payload *fleetpb.CreateAircraftTypeRequest) (*fleetpb.AircraftType, error) {
	return s.fleetService.CreateAircraftType(ctx, payload)
}

func (s *FleetServer) ListAircraftTypes(ctx context.Context, _ *emptypb.Empty) (*fleetpb.ListAircraftTypesResponse, error) {
	return s.fleetService.ListAircraftTypes(ctx)
}

func (s *FleetServer) GetAircraftType(ctx context.Context, payload *fleetpb.GetAircraftTypeRequest) (*fleetpb.AircraftType, error) {
	return s.fleetService.GetAircraftType(ctx, payload.Id)
}
