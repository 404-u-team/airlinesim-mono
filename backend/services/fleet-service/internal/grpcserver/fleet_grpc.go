package grpcserver

import "github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/service"

type FleetServer struct {
	service service.FleetService
}

func NewFleetServer(service service.FleetService) *FleetServer {
	return &FleetServer{service: service}
}
