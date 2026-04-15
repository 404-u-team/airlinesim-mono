package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/dto"
	grpcerrors "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/errors"
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

// Register godoc
// @Summary      Register user
// @Description  Returns access token and sets refresh token into cookie
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param request body dto.RegisterRequest true "User registration details"
// @Success      201  {object}  dto.AccessTokenResponse "User created and authenticated"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - email exists, 3 - nickname exists"
// @Failure      500 "Internal server error"
// @Router       /auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	// getting payload and validate it
	var payload dto.RegisterRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
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
		if errors.Is(err, grpcerrors.ErrUserWithSuchEmailExists) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		if errors.Is(err, grpcerrors.ErrUserWithSuchNicknameExists) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 3})
			return
		}
		c.Status(http.StatusInternalServerError)
		return
	}

	// set refresh token into cookie and send access token just as json
	setTokenIntoCookie(c, tokenResponse.RefreshToken, int(h.config.JWTRefreshTokenExpireTime))
	c.JSON(http.StatusCreated, dto.AccessTokenResponse{AccessToken: tokenResponse.AccessToken})
}

// Login godoc
// @Summary      Login user
// @Description  Returns access token and sets refresh token into cookie
// @Tags         Auth
// @Accept       json
// @Produce      json
// @Param request body dto.LoginRequest true "User login details"
// @Success      200  {object}  dto.AccessTokenResponse "User authenticated"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - user not found"
// @Failure      500 "Internal server error"
// @Router       /auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	// getting payload and validate it
	var payload dto.LoginRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
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
		if errors.Is(err, grpcerrors.ErrUserNotFound) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		c.Status(http.StatusInternalServerError)
		return
	}

	// set refresh token into cookie and send access token just as json
	setTokenIntoCookie(c, tokenResponse.RefreshToken, int(h.config.JWTRefreshTokenExpireTime))
	c.JSON(http.StatusOK, dto.AccessTokenResponse{AccessToken: tokenResponse.AccessToken})
}

// RefreshToken godoc
// @Summary      Refreshes access and refresh token using refresh token stored in cookies
// @Description  Returns access token and sets refresh token into cookie
// @Tags         Auth
// @Produce      json
// @Success      200  {object}  dto.AccessTokenResponse "User authenticated"
// @Failure      401 "Refresh token or user is not valid"
// @Failure      500 "Internal server error"
// @Router       /auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// getting refresh token out of cookie
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil {
		c.Status(http.StatusUnauthorized)
		return
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	// grpc login
	tokenResponse, err := h.authClient.RefreshToken(ctx, &authpb.RefreshTokenRequest{RefreshToken: refreshToken})
	if err != nil {
		if errors.Is(err, grpcerrors.ErrUserUnauthenticated) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
			return
		}
		c.Status(http.StatusInternalServerError)
		return
	}

	// set refresh token into cookie and send access token just as json
	setTokenIntoCookie(c, tokenResponse.RefreshToken, int(h.config.JWTRefreshTokenExpireTime))
	c.JSON(http.StatusOK, dto.AccessTokenResponse{AccessToken: tokenResponse.AccessToken})
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
