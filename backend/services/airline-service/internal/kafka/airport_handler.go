package kafka

import (
	"context"
	"fmt"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/repository"
	"github.com/google/uuid"
	"github.com/twmb/franz-go/pkg/kgo"
)

func NewAirportCreatedHandler(airportViewRepo repository.AirportViewRepository) MessageHandler {
	return func(ctx context.Context, record *kgo.Record) error {
		airportID, err := uuid.FromBytes(record.Key)
		if err != nil {
			return fmt.Errorf("got error when tried to parse airport id from kafka key: %w", err)
		}

		if err := airportViewRepo.CreateAirportView(ctx, airportID); err != nil {
			return fmt.Errorf("got error when tried to create aiport, %w", err)
		}

		return nil
	}
}

func NewAirportDeletedHandler(airportViewRepo repository.AirportViewRepository) MessageHandler {
	return func(ctx context.Context, record *kgo.Record) error {
		airportID, err := uuid.FromBytes(record.Key)
		if err != nil {
			return fmt.Errorf("got error when tried to parse airport id from kafka key: %w", err)
		}

		if err := airportViewRepo.DeleteAirportView(ctx, airportID); err != nil {
			return fmt.Errorf("got error when tried to delete aiport, %w", err)
		}

		return nil
	}
}
