package handlers

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/dto"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	authClient *grpcclient.AuthClient
	config     *config.Config
}

func NewAuthHandler(authClient *grpcclient.AuthClient, config *config.Config) *AuthHandler {
	return &AuthHandler{authClient: authClient, config: config}
}

func (h *AuthHandler) Register(c *gin.Context) {
	// getting payload and validate it
	var payload dto.RegisterRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// creating grpc register request
	registerRequest := authpb.RegisterRequest{
		Email:    payload.Email,
		Nickname: payload.Nickname,
		Password: payload.Password,
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	// grpc register
	tokenResponse, err := h.authClient.Register(ctx, &registerRequest)
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// set refresh token into cookie and send access token just as json
	setTokenIntoCookie(c, tokenResponse.RefreshToken, int(h.config.JWTRefreshTokenExpireTime))
	c.JSON(http.StatusCreated, dto.AccessTokenResponse{AccessToken: tokenResponse.AccessToken})
}

func (h *AuthHandler) Login(c *gin.Context) {
	// getting payload and validate it
	var payload dto.LoginRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// creating grpc register request
	loginRequest := authpb.LoginRequest{
		Login:    payload.Login,
		Password: payload.Password,
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	// grpc login
	tokenResponse, err := h.authClient.Login(ctx, &loginRequest)
	if err != nil {
		log.Println(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// set refresh token into cookie and send access token just as json
	setTokenIntoCookie(c, tokenResponse.RefreshToken, int(h.config.JWTRefreshTokenExpireTime))
	c.JSON(http.StatusCreated, dto.AccessTokenResponse{AccessToken: tokenResponse.AccessToken})
}

func setTokenIntoCookie(c *gin.Context, token string, expirationTime int) {
	c.SetCookie(
		"refresh_token", // key
		token,           // value
		expirationTime,  // время жизни внутри куки
		"/",             // path
		"",              // domain
		false,           // secure
		true,            // http only
	)
}
