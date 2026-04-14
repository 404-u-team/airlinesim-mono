package config

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log"
	"os"
	"strconv"
)

type Config struct {
	PostgresConnString string

	JWTPrivateKey *rsa.PrivateKey
	JWTPublicKey  *rsa.PublicKey

	JWTAccessTokenExpireTime  int64
	JWTRefreshTokenExpireTime int64
}

func InitConfig() Config {
	postgresConnString := fmt.Sprintf("postgres://%s:%s@%s:5432/%s?sslmode=disable",
		getEnv("POSTGRES_USER", "postgres"),
		getEnv("POSTGRES_PASSWORD", "password"),
		getEnv("POSTGRES_HOST", "postgres"),
		getEnv("POSTGRES_DB", "db"),
	)

	privateKey, err := loadPKCS8PrivateKey("./private_key.pem")
	if err != nil {
		log.Println("got error when tried to get private key, ", err)
	}

	publicKey, err := loadPublicKey("./public_key.pem")
	if err != nil {
		log.Println("got error when tried to get public key, ", err)
	}

	return Config{
		PostgresConnString:        postgresConnString,
		JWTPrivateKey:             privateKey,
		JWTPublicKey:              publicKey,
		JWTAccessTokenExpireTime:  getEnvAsInt("JWT_ACCESS_TOKEN_EXPIRE_TIME", 900),
		JWTRefreshTokenExpireTime: getEnvAsInt("JWT_REFRESH_TOKEN_EXPIRE_TIME", 86400),
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

func loadPKCS8PrivateKey(filename string) (*rsa.PrivateKey, error) {
	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(data)
	if block == nil || block.Type != "PRIVATE KEY" {
		return nil, fmt.Errorf("failed to decode PKCS#8 private key")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}

	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("key is not an RSA private key")
	}
	return rsaKey, nil
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
