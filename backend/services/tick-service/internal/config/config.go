package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/lpernett/godotenv"
)

type Config struct {
	PostgresConnString string

	KafkaBrokers         []string
	KafkaConsumerWorkers int

	StartRealTime  int64
	StartGameTime  int64
	TimeMultiplier int64
}

func InitConfig() Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("backend/services/tick-service/.env")

	postgresConnString := fmt.Sprintf("postgres://%s:%s@%s:5432/%s?sslmode=disable",
		getEnv("POSTGRES_USER", "postgres"),
		getEnv("POSTGRES_PASSWORD", "password"),
		getEnv("POSTGRES_HOST", "postgres"),
		getEnv("POSTGRES_DB", "db"),
	)

	return Config{
		PostgresConnString: postgresConnString,
		KafkaBrokers:       strings.Split(getEnv("KAFKA_BROKERS", "kafka:9092"), ","),
		StartRealTime:      getEnvAsInt("START_REAL_TIME", 1777971530),
		StartGameTime:      getEnvAsInt("START_GAME_TIME", 1777971530),
		TimeMultiplier:     getEnvAsInt("TIME_MULTIPLIER", 15),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}

	log.Printf("cant find env by key: %v, using: %v", key, fallback)
	return fallback
}

func getEnvAsInt(key string, fallback int64) int64 {
	if value, ok := os.LookupEnv(key); ok {
		i, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return fallback
		}

		return i
	}

	log.Printf("cant find env by key: %v, using: %v", key, fallback)
	return fallback
}
