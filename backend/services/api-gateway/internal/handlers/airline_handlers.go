package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/dto"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/middleware"
	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/gin-gonic/gin"
)

type AirlineHandler struct {
	airlineClient *grpcclient.AirlineClient
}

func NewAirlineHandler(airlineClient *grpcclient.AirlineClient) *AirlineHandler {
	return &AirlineHandler{airlineClient: airlineClient}
}

// CreateAirline godoc
// @Summary      Create airline
// @Description  Creates an airline for the authenticated user
// @Tags         Airline
// @Accept       json
// @Produce      json
// @Param request body airlinepb.CreateAirlineRequest true "Airline details"
// @Success      201  {object}  airlinepb.CreateAirlineResponse "Airline created successfully"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - airport not found, 3 - user not found"
// @Failure      401  "Unauthorized"
// @Failure      409  "Airline conflict"
// @Failure      500  "Internal server error"
// @Router       /airline [post]
func (h *AirlineHandler) CreateAirline(c *gin.Context) {
	var payload airlinepb.CreateAirlineRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	userID, exists := c.Get(middleware.UserIDKey)
	if !exists {
		c.Status(http.StatusUnauthorized)
		return
	}
	payload.OwnerId = userID.(string)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.airlineClient.CreateAirline(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrAirportNotFound) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		if errors.Is(err, customerrors.ErrUserNotFound) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 3})
			return
		}
		if errors.Is(err, customerrors.ErrAirlineWithSuchOwnerExists) || errors.Is(err, customerrors.ErrAirlineNameConflict) || errors.Is(err, customerrors.ErrAirlineIataConflict) || errors.Is(err, customerrors.ErrAirlineIcaoConflict) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC create airline, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, response)
}
