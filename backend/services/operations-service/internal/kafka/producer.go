package kafka

import (
	"context"
	"encoding/json"

	"github.com/twmb/franz-go/pkg/kgo"
)

type Producer interface {
	Send(ctx context.Context, topic string, key []byte, value any) error
	Close()
}

type FranzProducer struct {
	client *kgo.Client
}

func NewProducer(brokers []string) (*FranzProducer, error) {
	client, err := kgo.NewClient(
		kgo.SeedBrokers(brokers...),
		kgo.AllowAutoTopicCreation(),
	)
	if err != nil {
		return nil, err
	}
	return &FranzProducer{client: client}, nil
}

func (p *FranzProducer) Send(ctx context.Context, topic string, key []byte, value any) error {
	valBytes, err := json.Marshal(value)
	if err != nil {
		return err
	}

	record := &kgo.Record{
		Topic: topic,
		Key:   key,
		Value: valBytes,
	}
	return p.client.ProduceSync(ctx, record).FirstErr()
}

func (p *FranzProducer) Close() {
	p.client.Close()
}
