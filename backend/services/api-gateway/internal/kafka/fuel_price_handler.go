package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/realtime"
	"github.com/twmb/franz-go/pkg/kgo"
)

func NewFuelPriceHandler(socketHub realtime.Hub) MessageHandler {
	return func(ctx context.Context, record *kgo.Record) error {
		var event realtime.FuelPriceChangedEvent
		if err := json.Unmarshal(record.Value, &event); err != nil {
			return fmt.Errorf("got error when tried to unmarshal fuel price changed event, %w", err)
		}

		if err := socketHub.BroadcastFuelPriceChanged(event); err != nil {
			return fmt.Errorf("got error when tried to broadcast fuel price changed event, %w", err)
		}

		return nil
	}
}
