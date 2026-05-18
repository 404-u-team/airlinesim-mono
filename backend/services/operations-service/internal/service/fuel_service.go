package service

import (
	"context"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/repository"
)

type FuelService interface{}

type fuelService struct {
	lastPrice float64
	fuelRepo  repository.FuelRepository
}

func NewFuelService(fuelRepo repository.FuelRepository) (FuelService, error) {
	// creating service
	service := fuelService{fuelRepo: fuelRepo}

	// setting start price

	// returning service
	return service, nil
}

func (s *fuelService) SetNewFuelPrice(ctx context.Context) (float64, time.Time, error) {
	newPrice := wobblePrice(s.lastPrice)

	recordedAt, err := s.fuelRepo.SetNewFuelPrice(ctx, newPrice)
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("got error when tried to set new fuel price, %w", err)
	}

	return newPrice, recordedAt, nil
}

// just simple function to mock
func wobblePrice(currentPrice float64) float64 {
	const standard = 100
	const lowBound = 80
	const highBound = 120
	const lowUpProb = 0.2  // probability of going up when price >= highBound
	const highUpProb = 0.8 // probability of going up when price <= lowBound
	const midUpProb = 0.5  // at standard

	clamped := currentPrice
	if clamped > highBound {
		clamped = highBound
	}
	if clamped < lowBound {
		clamped = lowBound
	}

	var upProb float64
	if clamped >= standard {
		slope := (lowUpProb - midUpProb) / float64(highBound-standard)
		upProb = midUpProb + slope*float64(clamped-standard)
	} else {
		slope := (midUpProb - highUpProb) / float64(standard-lowBound)
		upProb = highUpProb + slope*float64(clamped-lowBound)
	}

	// Decide direction
	if rand.Float64() < upProb {
		return currentPrice + rand.Float64()*3 // wobble up
	}
	return currentPrice - rand.Float64()*3 // wobble down
}
