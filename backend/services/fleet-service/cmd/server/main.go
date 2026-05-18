package main

import (
	"log"
	"net"

	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/grpcserver"
	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/fleet-service/internal/service"
	"google.golang.org/grpc"
)

func main() {
	config := config.InitConfig()

	db.MigrateDatabase(config.PostgresConnString)

	pool := db.NewPostgresPool(config.PostgresConnString)
	defer pool.Close()

	fleetRepo := repository.NewFleetRepository(pool)
	fleetService := service.NewFleetService(fleetRepo)
	_ = grpcserver.NewFleetServer(fleetService)

	lis, err := net.Listen("tcp", config.GRPCPort)
	if err != nil {
		log.Fatalf("got error when tried to listen %s, %v", config.GRPCPort, err)
	}

	grpcServer := grpc.NewServer()
	log.Printf("The Fleet gRPC server is listening on %s", config.GRPCPort)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("got error when serve gRPC, %v", err)
	}
}
