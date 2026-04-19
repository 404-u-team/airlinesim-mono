package services

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/dto"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/events"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/repository"
	"github.com/jackc/pgx/v5"
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
	switch event.ImportType {
	case "country":
		var payload dto.CreateCountryRequest
		if err := json.Unmarshal(event.Payload, &payload); err != nil {
			return fmt.Errorf("invalid create country payload: %w", err)
		}
		err := s.countryRepo.CreateCountry(ctx, &payload)
		if err != nil && err != pgx.ErrNoRows {
			return fmt.Errorf("error in create country repo: %w", err)
		}
	default:
		return fmt.Errorf("unexpected import type: %v", event.ImportType)
	}

	return nil
}
