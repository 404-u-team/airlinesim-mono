package kafka

import "time"

type FuelPriceChangedEvent struct {
	Price      float64   `json:"price"`
	RecordedAt time.Time `json:"recorded_at"`
}
