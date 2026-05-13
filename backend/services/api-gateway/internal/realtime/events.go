package realtime

import "time"

const FuelPriceChangedEventName = "fuel_price_changed"

type FuelPriceChangedEvent struct {
	Price      float64   `json:"price"`
	RecordedAt time.Time `json:"recorded_at"`
}
