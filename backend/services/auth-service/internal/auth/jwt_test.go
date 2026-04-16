package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"testing"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/config"
	"github.com/google/uuid"
)

func testConfig(t *testing.T) *config.Config {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}

	return &config.Config{
		JWTPrivateKey:             privateKey,
		JWTPublicKey:              &privateKey.PublicKey,
		JWTAccessTokenExpireTime:  60,
		JWTRefreshTokenExpireTime: 120,
	}
}

func TestCreateSignedToken(t *testing.T) {
	config := testConfig(t)

	t.Run("correct creation", func(t *testing.T) {
		token, err := CreateSignedToken(uuid.New(), "user", config.JWTAccessTokenExpireTime, config.JWTPrivateKey)
		if err != nil {
			t.Fatalf("expected correct creation, got %v", err)
		}

		if token == "" {
			t.Fatalf("returned empty string, want jwt token")
		}
	})
}

func TestVerifyToken(t *testing.T) {
	config := testConfig(t)

	t.Run("correct vertify", func(t *testing.T) {
		userID := uuid.New()
		role := "user"

		tokenString, err := CreateSignedToken(userID, role, config.JWTAccessTokenExpireTime, config.JWTPrivateKey)
		if err != nil {
			t.Fatalf("got error when tried to create token, %v", err)
		}

		tokenUserID, tokenRole, err := VerifyToken(tokenString, config.JWTPublicKey)
		if err != nil {
			t.Fatalf("got error when tried to verify token, %v", err)
		}

		if tokenUserID != userID {
			t.Fatalf("wrong userID, want %v, got %v", userID, tokenUserID)
		}

		if tokenRole != role {
			t.Fatalf("wrong role, want %v, got %v", role, tokenRole)
		}
	})

	t.Run("wrong public key", func(t *testing.T) {
		privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			t.Fatalf("generate rsa key: %v", err)
		}
		publicKey := privateKey.PublicKey

		userID := uuid.New()
		role := "user"

		tokenString, err := CreateSignedToken(userID, role, config.JWTAccessTokenExpireTime, config.JWTPrivateKey)
		if err != nil {
			t.Fatalf("got error when tried to create token, %v", err)
		}

		_, _, err = VerifyToken(tokenString, &publicKey)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}
