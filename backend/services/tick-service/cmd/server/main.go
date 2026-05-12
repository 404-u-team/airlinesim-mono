package main

import (
	"log"

	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/kafka"
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

	// setup repositories, services

}
