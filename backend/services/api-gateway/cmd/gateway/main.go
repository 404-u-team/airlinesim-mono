package main

import (
	"log"
	"net/http"

	_ "github.com/404-u-team/airlinesim-mono/backend/api-gateway/cmd/gateway/docs"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
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

	// create gRPC client for world service communication
	worldClient, err := grpcclient.NewWorldClient("world-service:50051")

	// setup HTTP server
	router := routes.SetupRoutes(authClient, worldClient, &config)

	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", router); err != nil {
		log.Fatal(err)
	}
}
