package kafka

import (
	"context"
	"log"
	"sync"

	"github.com/twmb/franz-go/pkg/kgo"
)

type MessageHandler func(context context.Context, record *kgo.Record) error

type Consumer struct {
	client      *kgo.Client
	handler     MessageHandler
	workerCount int
	jobs        chan *kgo.Record
}

func NewConsumer(brokers []string, groupID string, topics []string, handler MessageHandler, workerCount int) (*Consumer, error) {
	if workerCount < 1 {
		workerCount = 1
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
		client:      client,
		handler:     handler,
		workerCount: workerCount,
		jobs:        make(chan *kgo.Record, workerCount*2),
	}, nil
}

func (c *Consumer) Run(ctx context.Context) error {
	var workers sync.WaitGroup
	for i := 0; i < c.workerCount; i++ {
		workers.Add(1)
		go func() {
			defer workers.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case record, ok := <-c.jobs:
					if !ok {
						return
					}

					if err := c.handler(ctx, record); err != nil {
						log.Println("got error when tried to process record in consumer")
						// TODO: put bad records in DLQ
					}
				}
			}
		}()
	}

	defer func() {
		close(c.jobs)
		workers.Wait()
	}()

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
				select {
				case c.jobs <- record:
				case <-ctx.Done():
					return
				}
			}
		})
	}
}

func (c *Consumer) Close() {
	c.client.Close()
}
