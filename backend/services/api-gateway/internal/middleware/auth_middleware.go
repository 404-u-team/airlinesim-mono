package middleware

import (
	"context"
	"crypto/rsa"
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
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}

		// verify just token signature
		userID, role, err := verifyTokenLocal(tokenString, JWTPublicKey)
		if err != nil {
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
			c.Status(http.StatusInternalServerError)
			c.Abort()
			return
		}

		if !verifyTokenResponse.Valid {
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
			c.Status(http.StatusUnauthorized)
			c.Abort()
			return
		}

		if role != "admin" {
			c.Status(http.StatusUnauthorized)
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
