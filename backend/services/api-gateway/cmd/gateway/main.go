package main

import (
	"context"
	"log"
	"net/http"
	"os/signal"
	"syscall"

	_ "github.com/404-u-team/airlinesim-mono/backend/api-gateway/cmd/gateway/docs"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/kafka"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/routes"
)

// @title           AirlineSim API
// @version         1.0
// @openapi         3.0.0
// @contact.name   Jeno7u
// @contact.url    https://github.com/Jeno7u
// @contact.email  lboris201@yandex.ru
// @host           localhost:8080
// @schemes        http https

func main() {
	// get config from env
	config := config.InitConfig()

	// create gRPC client for auth service communication
	authClient, err := grpcclient.NewAuthClient("auth-service:50051")
	if err != nil {
		log.Println("got error when tried to connect to gRPC server, ", err)
	}
	defer authClient.Close()

	// create kafka consumer and run it
	handlers := kafka.HandlerMap{
		kafka.TopicOperationsFuelPriceChanged: kafka.NewFuelPriceHandler(),
	}
	consumer, err := kafka.NewConsumer(
		config.KafkaBrokers,
		"gateway-service-group",
		[]string{kafka.TopicOperationsFuelPriceChanged},
		handlers,
	)
	if err != nil {
		log.Fatalf("got error during Kafka consumer initializing, %v", err)
	}
	defer consumer.Close()

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	go func() {
		if err := consumer.Run(ctx); err != nil && err != context.Canceled {
			log.Fatalf("got error while running consumer, %v", err)
		}
	}()

	// create gRPC client for operations service communication
	operationsClient, err := grpcclient.NewOperationsClient("operations-service:50051")

	// setup HTTP server
	router := routes.SetupRoutes(authClient, operationsClient, &config)

	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal(err)
	}
}
