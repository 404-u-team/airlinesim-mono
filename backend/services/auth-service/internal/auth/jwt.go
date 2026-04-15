package auth

import (
	"crypto/rsa"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/google/uuid"
)

func CreateSignedToken(userID uuid.UUID, role string, expirationInSeconds int64, privateKey *rsa.PrivateKey) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, jwt.MapClaims{
		"sub":  userID.String(),
		"role": role,
		"exp":  time.Now().Add(time.Duration(expirationInSeconds) * time.Second).Unix(),
	})

	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign token: %w", err)
	}
	return tokenString, nil
}

// if token is valid and didnt expired will return userID and role
func VerifyToken(tokenString string, publicKey *rsa.PublicKey) (uuid.UUID, string, error) {
	// verifying token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return publicKey, nil
	})

	if err != nil {
		return uuid.Nil, "", fmt.Errorf("failed to parse/verify token: %w", err)
	}

	// getting claims
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return uuid.Nil, "", fmt.Errorf("bad token")
	}

	// checking expiration time
	if exp, ok := claims["exp"].(float64); ok {
		if float64(time.Now().Unix()) > exp {
			return uuid.Nil, "", fmt.Errorf("token is expired")
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
