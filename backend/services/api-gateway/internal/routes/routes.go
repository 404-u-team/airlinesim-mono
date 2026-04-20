package routes

import (
	"log"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/handlers"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/middleware"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func SetupRoutes(authClient *grpcclient.AuthClient, worldClient *grpcclient.WorldClient, config *config.Config) *gin.Engine {
	router := gin.Default()

	authHandler := handlers.NewAuthHandler(authClient, config)
	worldHandler := handlers.NewWorldHandler(worldClient, config) // maybe config is extra

	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := router.Group("")
	{
		// public endpoints
		api.POST("/auth/register", authHandler.Register)
		api.POST("/auth/login", authHandler.Login)
		api.POST("/auth/refresh", authHandler.RefreshToken)

		// protected endpoints
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(config.JWTPublicKey, authClient))
		{
			// admin only
			adminOnly := api.Group("")
			adminOnly.Use(middleware.AuthMiddleware(config.JWTPublicKey, authClient), middleware.AdminMiddleware())
			{
				adminOnly.POST("/country", worldHandler.CreateCountry)
			}
		}
	}

	return router
}

// create gRPC client and handler for auth service communication
func createAuthHandler() {
	authClient, err := grpcclient.NewAuthClient("auth-service:50051")
	if err != nil {
		log.Fatalf("got error when tried to connect to gRPC server, %v", err)
	}
	defer authClient.Close()
}
