package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/google/uuid"
)

func CreateJWT(secret []byte, userID uuid.UUID, expirationTime int) (string, error) {
	expiration := time.Second * time.Duration(expirationTime)

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": userID.String(),                   // стандарт в jwt, подразумевает userID
		"exp": time.Now().Add(expiration).Unix(), // время конца жизни
	})

	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// возвращает "sub" из токена, если валиден
func ValidateJWT(secret []byte, tokenString string) (uuid.UUID, error) {
	// парсинг и валидация токена
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("ожидался другой способ создания подписи токена: %v", token.Header["alg"])
		}
		return secret, nil
	})
	if err != nil {
		return uuid.Nil, err
	}

	// получаем claims
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return uuid.Nil, fmt.Errorf("некорректный токен")
	}

	if exp, ok := claims["exp"].(float64); ok {
		if float64(time.Now().Unix()) > exp {
			return uuid.Nil, fmt.Errorf("время жизни токена истекло")
		}
	} else {
		return uuid.Nil, fmt.Errorf("отсутствует exp внутри токена")
	}

	sub, ok := claims["sub"].(string)
	if !ok {
		return uuid.Nil, fmt.Errorf("отсутствует sub внутри токена")
	}

	userID, err := uuid.Parse(sub)
	if err != nil {
		return uuid.Nil, fmt.Errorf("неправильный формат uuid в 'sub' токена: %v", err)
	}

	return userID, nil
}
