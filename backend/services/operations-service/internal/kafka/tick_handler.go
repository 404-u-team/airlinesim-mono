package kafka

import (
	"context"
	"fmt"
	"time"

	"github.com/twmb/franz-go/pkg/kgo"
)

type FuelPriceService interface {
	SetNewFuelPrice(ctx context.Context) (float64, time.Time, error)
}

func New15MinElapsedHandler() MessageHandler {
	return func(ctx context.Context, record *kgo.Record) error {

		return nil
	}
}

func New1HourElapsedHandler(fuelService FuelPriceService) MessageHandler {
	return func(ctx context.Context, record *kgo.Record) error {
		_, _, err := fuelService.SetNewFuelPrice(ctx)
		if err != nil {
			return fmt.Errorf("got error when tried to set new fuel price, %w", err)
		}

		return nil
	}
}
