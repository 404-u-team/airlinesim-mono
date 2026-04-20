package handlers

import (
	"net/http"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/dto"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	"github.com/gin-gonic/gin"
)

type WorldHandler struct {
	worldClient *grpcclient.WorldClient
	config      *config.Config
}

func NewWorldHandler(worldClient *grpcclient.WorldClient, config *config.Config) *WorldHandler {
	return &WorldHandler{worldClient: worldClient, config: config}
}

// CreateCountry godoc
// @Summary      Add country (admin only)
// @Description  Returns
// @Tags         Country
// @Accept       json
// @Produce      json
// @Param request body dto.CreateCountryRequest true "Country details"
// @Success      201  {object}  dto.IDResponse "Country created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - iso exists"
// @Failure      500 "Internal server error"
// @Router       /create-country [post]
func (h *WorldHandler) CreateCountry(c *gin.Context) {
	// getting payload and validate it
	var payload dto.CreateCountryRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	return

	// creating grpc create country request
	// registerRequest := authpb.{
	// 	Email:    payload.Email,
	// 	Nickname: payload.Nickname,
	// 	Password: payload.Password,
	// }

	// // set timeout of request
	// ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	// defer cancel()

	// // grpc register
	// tokenResponse, err := h.authClient.Register(ctx, &registerRequest)
	// if err != nil {
	// 	if errors.Is(err, grpcerrors.ErrUserWithSuchEmailExists) {
	// 		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
	// 		return
	// 	}
	// 	if errors.Is(err, grpcerrors.ErrUserWithSuchNicknameExists) {
	// 		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 3})
	// 		return
	// 	}
	// 	c.Status(http.StatusInternalServerError)
	// 	return
	// }

	// // set refresh token into cookie and send access token just as json
	// setTokenIntoCookie(c, tokenResponse.RefreshToken, int(h.config.JWTRefreshTokenExpireTime))
	// c.JSON(http.StatusCreated, dto.AccessTokenResponse{AccessToken: tokenResponse.AccessToken})
}
