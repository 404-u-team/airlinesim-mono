package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := strings.TrimSpace(c.GetHeader("Origin"))
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
			allowedHeaders := strings.TrimSpace(c.GetHeader("Access-Control-Request-Headers"))
			if allowedHeaders == "" {
				allowedHeaders = "Authorization,Content-Type,Accept,Origin,X-Requested-With,Cache-Control,Pragma"
			}
			c.Header("Access-Control-Allow-Headers", allowedHeaders)
			c.Header("Access-Control-Expose-Headers", "Content-Length,Content-Type")
			c.Header("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
