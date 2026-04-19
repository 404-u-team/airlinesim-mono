package kafka

import (
	"context"
	"log"

	"github.com/twmb/franz-go/pkg/kgo"
)

type MessageHandler func(context context.Context, record *kgo.Record) error

type Consumer struct {
	client  *kgo.Client
	handler MessageHandler
}

func NewConsumer(brokers []string, groupID string, topics []string, handler MessageHandler) (*Consumer, error) {
	client, err := kgo.NewClient(
		kgo.SeedBrokers(brokers...),
		kgo.ConsumerGroup(groupID),
		kgo.ConsumeTopics(topics...),
	)
	if err != nil {
		return nil, err
	}
	return &Consumer{client: client, handler: handler}, nil
}

func (c *Consumer) Run(ctx context.Context) error {
	for {
		fetches := c.client.PollFetches(ctx)
		if errs := fetches.Errors(); len(errs) > 0 {
			log.Println("got error when tried to do poll fetched, ", errs)
			continue
		}

		fetches.EachPartition(func(p kgo.FetchTopicPartition) {
			for _, record := range p.Records {
				if err := c.handler(ctx, record); err != nil {
					log.Println("got error when tried to process record in consumer")
					// TODO: put bad records in DLQ
					continue
				}
			}
		})
	}
}

func (c *Consumer) Close() {
	c.client.Close()
}
