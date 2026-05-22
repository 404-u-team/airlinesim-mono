package routes

import (
	"log"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/handlers"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/middleware"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/realtime"
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func SetupRoutes(authClient *grpcclient.AuthClient, operationsClient *grpcclient.OperationsClient, fleetClient *grpcclient.FleetClient, airlineClient *grpcclient.AirlineClient, socketHub realtime.Hub, config *config.Config) *gin.Engine {
	router := gin.Default()
	router.Use(middleware.CORSMiddleware())

	authHandler := handlers.NewAuthHandler(authClient, config)
	airlineHandler := handlers.NewAirlineHandler(airlineClient)
	operationsHandler := handlers.NewOperationsHandler(operationsClient, config) // maybe config is extra
	fleetHandler := handlers.NewFleetHandler(fleetClient)

	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	router.GET("/socket.io/*any", gin.WrapH(socketHub.Handler()))
	router.POST("/socket.io/*any", gin.WrapH(socketHub.Handler()))

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
			protected.GET("/airline/me", airlineHandler.GetMyAirline)
			protected.GET("/airline/:id", airlineHandler.GetAirlineByID)
			protected.POST("/airline", airlineHandler.CreateAirline)
			protected.POST("/aircraft", fleetHandler.PurchaseAircraft)
			protected.GET("/aircraft-types", fleetHandler.ListAircraftTypes)

			// admin only
			adminOnly := api.Group("")
			adminOnly.Use(middleware.AuthMiddleware(config.JWTPublicKey, authClient), middleware.AdminMiddleware())
			{
				adminOnly.POST("/country", operationsHandler.CreateCountry)
				adminOnly.PUT("/country/:id", operationsHandler.ChangeCountry)
				adminOnly.GET("/countries", operationsHandler.ListCountries)
				adminOnly.DELETE("/country/:id", operationsHandler.DeleteCountry)

				adminOnly.POST("/region", operationsHandler.CreateRegion)
				adminOnly.PUT("/region/:id", operationsHandler.ChangeRegion)
				adminOnly.GET("/regions", operationsHandler.ListRegions)
				adminOnly.DELETE("/region/:id", operationsHandler.DeleteRegion)

				adminOnly.POST("/region-link", operationsHandler.CreateRegionLink)
				adminOnly.PUT("/region-link/:id", operationsHandler.ChangeRegionLink)
				adminOnly.GET("/region-links", operationsHandler.ListRegionLinks)
				adminOnly.DELETE("/region-link/:id", operationsHandler.DeleteRegionLink)

				adminOnly.POST("/airport", operationsHandler.CreateAirport)
				adminOnly.PUT("/airport/:id", operationsHandler.ChangeAirport)
				adminOnly.GET("/airports", operationsHandler.ListAirports)
				adminOnly.DELETE("/airport/:id", operationsHandler.DeleteAirport)
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
