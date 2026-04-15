package config

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/lpernett/godotenv"
)

type Config struct {
	JWTPublicKey *rsa.PublicKey

	JWTAccessTokenExpireTime  int64
	JWTRefreshTokenExpireTime int64
}

func InitConfig() Config {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("backend/services/api-gateway/.env")

	publicKey, err := loadPublicKey("./public_key.pem")
	if err != nil {
		log.Println("got error when tried to get public key, ", err)
	}

	return Config{
		JWTPublicKey:              publicKey,
		JWTAccessTokenExpireTime:  getEnvAsInt("JWT_ACCESS_TOKEN_EXPIRE_TIME", 900),
		JWTRefreshTokenExpireTime: getEnvAsInt("JWT_REFRESH_TOKEN_EXPIRE_TIME", 86400),
	}
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
