package main

import (
	"context"
	"log"
	"net"
	"os/signal"
	"syscall"

	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/db"
	operationsgrpc "github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/grpc"
	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/kafka"
	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/service"
	operationspb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/operations/v1"
	"google.golang.org/grpc"
)

func main() {
	config := config.InitConfig()

	// setup db
	db.MigrateDatabase(config.PostgresConnString)

	pool := db.NewPostgresPool(config.PostgresConnString)
	defer pool.Close()

	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("got error when tried to listen :50051, %v", err)
	}

	// setup Kafka producer
	producer, err := kafka.NewProducer(config.KafkaBrokers)
	if err != nil {
		log.Fatalf("got error during Kafka producer initializing, %v", err)
	}
	defer producer.Close()

	// setup repositories, services
	countryRepo := repository.NewCountryRepository(pool)
	regionRepo := repository.NewRegionRepository(pool)
	regionLinkRepo := repository.NewRegionLinkRepository(pool)
	airportRepo := repository.NewAirportRepository(pool)
	fuelRepo := repository.NewFuelRepository(pool)

	countryService := service.NewCountryService(countryRepo)
	regionService := service.NewRegionService(regionRepo)
	regionLinkService := service.NewRegionLinkService(regionLinkRepo)
	fuelService, err := service.NewFuelService(context.Background(), fuelRepo, producer, float64(config.StartFuelPrice))
	if err != nil {
		log.Fatalf("got error during fuel service initializing, %v", err)
	}
	airportService := service.NewAirportService(airportRepo, producer)

	// create kafka consumer and run it
	handlers := kafka.HandlerMap{
		kafka.TopicTick15MinElapsed: kafka.New15MinElapsedHandler(),
		kafka.TopicTick1HourElapsed: kafka.New1HourElapsedHandler(fuelService),
	}
	consumer, err := kafka.NewConsumer(
		config.KafkaBrokers,
		"operations-service-group",
		[]string{kafka.TopicTick15MinElapsed, kafka.TopicTick1HourElapsed},
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

	// create grpc server and run it
	operationsServer := operationsgrpc.NewOperationsServer(countryService, regionService, regionLinkService, airportService)
	grpcServer := grpc.NewServer()
	operationspb.RegisterOperationsServiceServer(grpcServer, operationsServer)

	log.Print("The Operations gRPC server is listening on :50051")
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("got error when serve gRPC, %v", err)
	}
}
