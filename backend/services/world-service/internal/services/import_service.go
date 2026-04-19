package services

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/events"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/repository"
)

type ImportService interface {
	ImportReceived(ctx context.Context, event *events.ImportDataReceivedEvent) error
}

type importService struct {
	countryRepo repository.CountryRepository
}

func NewImportService(countryRepo repository.CountryRepository) ImportService {
	return &importService{countryRepo: countryRepo}
}

func (s *importService) ImportReceived(ctx context.Context, event *events.ImportDataReceivedEvent) error {
	return nil
}
