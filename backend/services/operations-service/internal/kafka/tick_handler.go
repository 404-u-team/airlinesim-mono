package kafka

import (
	"context"

	"github.com/twmb/franz-go/pkg/kgo"
)

func New15MinElapsedHandler() MessageHandler {
	return func(ctx context.Context, record *kgo.Record) error {

		return nil
	}
}
