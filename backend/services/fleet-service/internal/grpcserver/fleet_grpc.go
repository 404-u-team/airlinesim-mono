package grpcserver

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/service"
	fleetpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/fleet/v1"
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
