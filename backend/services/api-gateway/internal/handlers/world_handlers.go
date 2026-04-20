package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/dto"
	customerrors "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/errors"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
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
// @Summary      Create country (admin only)
// @Description  Returns
// @Tags         Country
// @Accept       json
// @Produce      json
// @Param request body dto.CreateCountryRequest true "Country details"
// @Success      201  {object}  dto.IDResponse "Country created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error"
// @Failure      409 "Country with such ISO already exists"
// @Failure      500 "Internal server error"
// @Router       /country [post]
func (h *WorldHandler) CreateCountry(c *gin.Context) {
	// getting payload and validate it
	var payload worldpb.CreateCountryRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	// grpc create country
	IDResponse, err := h.worldClient.CreateCountry(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrISOConflict) {
			c.Status(http.StatusConflict)
			return
		}
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, IDResponse)
}
