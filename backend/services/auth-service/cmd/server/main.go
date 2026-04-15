package main

import (
	"log"
	"net"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/db"
	authgrpc "github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/grpc"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/service"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"google.golang.org/grpc"
)

func main() {
	config := config.InitConfig()

	// migrate DB
	db.MigrateDatabase(config.PostgresConnString)

	// setup DB pool
	pool := db.NewPostgresPool(config.PostgresConnString)
	defer pool.Close()

	// start gRPC server
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("got error when tried to listen :50051, %v", err)
	}

	authRepo := repository.NewUserRepository(pool)
	authService := service.NewAuthService(authRepo)
	authServer := authgrpc.NewAuthServer(authService)

	grpcServer := grpc.NewServer()
	authpb.RegisterAuthServiceServer(grpcServer, authServer)

	log.Print("The Auth gRPC server is listening on :50051")
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("got error when serve gRPC, %v", err)
	}
}
