package kafka

import (
	"context"
	"fmt"
	"log"

	"github.com/twmb/franz-go/pkg/kgo"
)

type MessageHandler func(context.Context, *kgo.Record) error

type HandlerMap map[string]MessageHandler

type Consumer struct {
	client   *kgo.Client
	handlers HandlerMap
}

func NewConsumer(brokers []string, groupID string, topics []string, handlers HandlerMap) (*Consumer, error) {
	for _, topic := range topics {
		if _, ok := handlers[topic]; !ok {
			return nil, fmt.Errorf("missing handler for topic %q", topic)
		}
	}

	client, err := kgo.NewClient(
		kgo.SeedBrokers(brokers...),
		kgo.ConsumerGroup(groupID),
		kgo.ConsumeTopics(topics...),
	)
	if err != nil {
		return nil, err
	}

	return &Consumer{
		client:   client,
		handlers: handlers,
	}, nil
}

func (c *Consumer) Run(ctx context.Context) error {
	for {
		fetches := c.client.PollFetches(ctx)
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if errs := fetches.Errors(); len(errs) > 0 {
			log.Println("got error when tried to do poll fetched, ", errs)
			continue
		}

		fetches.EachPartition(func(p kgo.FetchTopicPartition) {
			for _, record := range p.Records {
				handler, ok := c.handlers[record.Topic]
				if !ok {
					log.Println("got record for unsupported topic in consumer, ", record.Topic)
					continue
				}

				if err := handler(ctx, record); err != nil {
					log.Println("got error when tried to process record in consumer, ", err)
					// TODO: put bad records in DLQ
				}
			}
		})
	}
}

func (c *Consumer) Close() {
	c.client.Close()
}
