package config

import (
	"fmt"
	"log"
	"os"

	"github.com/lpernett/godotenv"
)

type Config struct {
	PostgresConnString string
	GRPCPort           string
	AirlineGRPCAddr    string
}

func InitConfig() Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("backend/services/fleet-service/.env")
	_ = godotenv.Load("../../../../../shared/config/.env")
	_ = godotenv.Load("backend/shared/config.env")

	postgresConnString := fmt.Sprintf("postgres://%s:%s@%s:5432/%s?sslmode=disable",
		getEnv("POSTGRES_USER", "postgres"),
		getEnv("POSTGRES_PASSWORD", "password"),
		getEnv("POSTGRES_HOST", "postgres"),
		getEnv("POSTGRES_DB", "db"),
	)

	return Config{
		PostgresConnString: postgresConnString,
		GRPCPort:           getEnv("GRPC_PORT", ":50054"),
		AirlineGRPCAddr:    getEnv("AIRLINE_GRPC_ADDR", "airline-service:50051"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	log.Printf("cant find env by key: %v, using: %v", key, fallback)
	return fallback
}
