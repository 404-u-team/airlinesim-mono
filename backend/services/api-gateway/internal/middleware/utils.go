package middleware

import (
	"crypto/rsa"
	"fmt"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/golang-jwt/jwt"
	"github.com/google/uuid"
)

// if token is valid and didnt expired will return userID and role
func verifyTokenLocal(tokenString string, publicKey *rsa.PublicKey) (uuid.UUID, string, error) {
	// verifying token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return publicKey, nil
	})

	if err != nil {
		return uuid.Nil, "", fmt.Errorf("got error when tried to parse token: %w", err)
	}

	if !token.Valid {
		return uuid.Nil, "", customerrors.ErrUserUnauthenticated
	}

	// getting claims
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return uuid.Nil, "", fmt.Errorf("bad token")
	}

	// checking expiration time
	if exp, ok := claims["exp"].(float64); ok {
		if float64(time.Now().Unix()) > exp {
			return uuid.Nil, "", customerrors.ErrUserUnauthenticated
		}
	} else {
		return uuid.Nil, "", fmt.Errorf("token dont have 'exp' key")
	}

	// getting 'sub'
	sub, ok := claims["sub"].(string)
	if !ok {
		return uuid.Nil, "", fmt.Errorf("token dont have 'sub' key")
	}

	userID, err := uuid.Parse(sub)
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("cant convert 'sub' from token to uuid: %v", err)
	}

	// getting 'role'
	role, ok := claims["role"].(string)
	if !ok {
		return uuid.Nil, "", fmt.Errorf("token dont have 'role' key")
	}

	return userID, role, nil
}
