package main

import (
	"log"
	"net"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/grpcclient"
	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/grpcserver"
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
