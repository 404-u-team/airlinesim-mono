package middleware

import (
	"context"
	"crypto/rsa"
	"log"
	"net/http"
	"strings"
	"time"

	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/gin-gonic/gin"
)

const UserIDKey = "userID"
const RoleKey = "role"

func AuthMiddleware(JWTPublicKey *rsa.PublicKey, authClient *grpcclient.AuthClient) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := getAccessToken(c)
		if tokenString == "" {
			log.Println("no token found in headers")
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}

		// verify just token signature
		userID, role, err := verifyTokenLocal(tokenString, JWTPublicKey)
		if err != nil {
			log.Println("got error when tried to verify token local, ", err)
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}

		// verify user in db through auth grpc client
		ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
		defer cancel()

		verifyTokenRequest := &authpb.VerifyTokenRequest{AccessToken: tokenString}
		verifyTokenResponse, err := authClient.VerifyToken(ctx, verifyTokenRequest)
		if err != nil {
			log.Println("got error when tried to verify token through auth servuce, ", err)
			c.Status(http.StatusInternalServerError)
			c.Abort()
			return
		}

		if !verifyTokenResponse.Valid {
			log.Println("token is not valid")
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}

		// закидываем userID и role в контекст
		c.Set(UserIDKey, userID)
		c.Set(RoleKey, role)
		c.Next()
	}
}

func AdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get(RoleKey)
		if !exists {
			log.Println("no role is found in context")
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}

		if role != "admin" {
			log.Println("user role is not admin, role is ", role)
			c.Status(http.StatusForbidden)
			c.Abort()
			return
		}

		c.Next()
	}
}

func getAccessToken(c *gin.Context) string {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" {
		return ""
	}

	parts := strings.Fields(authHeader)
	if len(parts) != 2 {
		return ""
	}

	if !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}

	return parts[1]
}
