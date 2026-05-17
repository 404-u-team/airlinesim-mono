package main

import (
	"log"
	"net"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	worldgrpc "github.com/404-u-team/airlinesim-mono/backend/game-service/internal/grpc"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/service"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
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
	// producer, err := kafka.NewProducer(config.KafkaBrokers)
	// if err != nil {
	// 	log.Fatalf("got error during Kafka producer initializing, %v", err)
	// }
	// defer producer.Close()

	countryRepo := repository.NewCountryRepository(pool)
	regionRepo := repository.NewRegionRepository(pool)
	regionLinkRepo := repository.NewRegionLinkRepository(pool)
	airportRepo := repository.NewAirportRepository(pool)

	countryService := service.NewCountryService(countryRepo)
	regionService := service.NewRegionService(regionRepo)
	regionLinkService := service.NewRegionLinkService(regionLinkRepo)
	airportService := service.NewAirportService(airportRepo)

	worldServer := worldgrpc.NewWorldServer(countryService, regionService, regionLinkService, airportService)

	grpcServer := grpc.NewServer()

	worldpb.RegisterWorldServiceServer(grpcServer, worldServer)

	log.Print("The Auth gRPC server is listening on :50051")
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("got error when serve gRPC, %v", err)
	}

	// setup Kafka consumer

	// consumerHandler := func(ctx context.Context, record *kgo.Record) error {
	// 	return importHandler.ImportReceived(ctx, record.Value)
	// }

	// consumer, err := kafka.NewConsumer(
	// 	config.KafkaBrokers,
	// 	"game-service-group", // Consumer Group ID
	// 	[]string{kafka.TopicImportDataReceived},
	// 	consumerHandler,
	// 	config.KafkaConsumerWorkers,
	// )
	// if err != nil {
	// 	log.Fatalf("got error during Kafka consumer initializing, %v", err)
	// }
	// defer consumer.Close()

	// run Kafka Consumer
	// ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	// defer cancel()

	// log.Println("Starting Kafka consumer...")
	// if err := consumer.Run(ctx); err != nil {
	// 	log.Fatalln("got error while running consumer, ", err)
	// }
}
