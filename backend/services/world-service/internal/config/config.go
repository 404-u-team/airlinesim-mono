package config

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log"
	"os"
	"runtime"
	"strconv"
	"strings"

	"github.com/lpernett/godotenv"
)

type Config struct {
	PostgresConnString string

	KafkaBrokers         []string
	KafkaConsumerWorkers int

	JWTPublicKey *rsa.PublicKey
}

func InitConfig() Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("backend/services/game-service/.env")

	postgresConnString := fmt.Sprintf("postgres://%s:%s@%s:5432/%s?sslmode=disable",
		getEnv("POSTGRES_USER", "postgres"),
		getEnv("POSTGRES_PASSWORD", "password"),
		getEnv("POSTGRES_HOST", "postgres"),
		getEnv("POSTGRES_DB", "db"),
	)

	publicKey, err := loadPublicKey("./public_key.pem")
	if err != nil {
		log.Println("got error when tried to get public key, ", err)
	}

	return Config{
		PostgresConnString:   postgresConnString,
		KafkaBrokers:         strings.Split(getEnv("KAFKA_BROKERS", "kafka:9092"), ","),
		KafkaConsumerWorkers: int(getEnvAsInt("KAFKA_CONSUMER_WORKERS", int64(runtime.NumCPU()))),
		JWTPublicKey:         publicKey,
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

func loadPublicKey(filename string) (*rsa.PublicKey, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(data)
	if block == nil || block.Type != "PUBLIC KEY" {
		return nil, fmt.Errorf("failed to decode public key")
	}

	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	rsaPub, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("key is not an RSA public key")
	}
	return rsaPub, nil
}
