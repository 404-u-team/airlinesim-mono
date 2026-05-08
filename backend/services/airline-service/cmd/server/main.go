package main

import (
	"context"
	"log"
	"net"
	"os/signal"
	"syscall"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/grpcclient"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/grpcserver"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/kafka"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/service"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	"google.golang.org/grpc"
)

func main() {
	config := config.InitConfig()

	// migrate DB
	db.MigrateDatabase(config.PostgresConnString)

	// setup DB pool
	pool := db.NewPostgresPool(config.PostgresConnString)
	defer pool.Close()

	// create auth grpc client
	authClient, err := grpcclient.NewAuthClient("auth-service:50051")
	if err != nil {
		log.Println("got error when tried to connect to gRPC server, ", err)
	}
	defer authClient.Close()

	// create repositories, services and other basic stuff
	airlineRepo := repository.NewAirlineRepository(pool)
	airportViewRepo := repository.NewAirportViewRepository(pool)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// create kafka consumer and run it
	handlers := kafka.HandlerMap{
		"operations_airport_created": kafka.NewAirportCreatedHandler(airportViewRepo),
		"operations_airport_deleted": kafka.NewAirportDeletedHandler(airportViewRepo),
	}
	consumer, err := kafka.NewConsumer(
		config.KafkaBrokers,
		"airline-service-group",
		[]string{"operations_airport_created"},
		handlers,
	)
	if err != nil {
		log.Fatalf("got error during Kafka consumer initializing, %v", err)
	}
	defer consumer.Close()

	go func() {
		if err := consumer.Run(ctx); err != nil && err != context.Canceled {
			log.Fatalf("got error while running consumer, %v", err)
		}
	}()

	airlineService := service.NewAirlineService(&config, airlineRepo, airportViewRepo, *authClient)

	// start gRPC server
	grpcServer := grpc.NewServer()
	airlineServer := grpcserver.NewAirlineServer(airlineService)
	airlinepb.RegisterAirlineServiceServer(grpcServer, airlineServer)

	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("got error when tried to listen :50051, %v", err)
	}

	log.Print("The Airline gRPC server is listening on :50051")
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("got error when serve gRPC, %v", err)
	}
}
