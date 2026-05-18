package main

import (
	"context"
	"log"
	"os/signal"
	"syscall"

	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/kafka"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/tick"
)

func main() {
	// setup config
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

	// setup repositories and other stuff
	gameStateRepo := repository.NewGameStateRepository(pool)

	tickLoop := tick.NewTickLoop(producer, gameStateRepo, &config)

	// run tick loop
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	if err := tickLoop.Run(ctx); err != nil {
		log.Println("got error when running tick loop, ", err)
	}
}
