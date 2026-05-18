package service

import "github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/repository"

type FleetService interface{}

type fleetService struct {
	repo repository.FleetRepository
}

func NewFleetService(repo repository.FleetRepository) FleetService {
	return &fleetService{repo: repo}
}
