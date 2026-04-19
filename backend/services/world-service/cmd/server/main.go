package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/handlers"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/kafka"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/services"
	"github.com/twmb/franz-go/pkg/kgo"
)

func main() {
	config := config.InitConfig()

	// setup db
	db.MigrateDatabase(config.PostgresConnString)

	pool := db.NewPostgresPool(config.PostgresConnString)
	defer pool.Close()

	// setup Kafka producer
	producer, err := kafka.NewProducer(config.KafkaBrokers)
	if err != nil {
		log.Fatalf("got error during Kafka producer initializing, %v", err)
	}
	defer producer.Close()

	// setup Kafka consumer
	countryRepo := repository.NewCountryRepository(pool)
	importService := services.NewImportService(countryRepo)
	importHandler := handlers.NewImportHandler(importService, producer)

	consumerHandler := func(ctx context.Context, record *kgo.Record) error {
		return importHandler.ImportReceived(ctx, record.Value)
	}

	consumer, err := kafka.NewConsumer(
		config.KafkaBrokers,
		"game-service-group", // Consumer Group ID
		[]string{kafka.TopicImportDataReceived},
		consumerHandler,
		config.KafkaConsumerWorkers,
	)
	if err != nil {
		log.Fatalf("got error during Kafka consumer initializing, %v", err)
	}
	defer consumer.Close()

	// run Kafka Consumer
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	log.Println("Starting Kafka consumer...")
	if err := consumer.Run(ctx); err != nil {
		log.Fatalln("got error while running consumer, ", err)
	}
}
