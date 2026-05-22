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
	fleetpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/fleet/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/gin-gonic/gin"
)

type FleetHandler struct {
	fleetClient *grpcclient.FleetClient
}

func NewFleetHandler(fleetClient *grpcclient.FleetClient) *FleetHandler {
	return &FleetHandler{fleetClient: fleetClient}
}

// PurchaseAircraft godoc
// @Summary      Purchase aircraft
// @Description  Purchases a new aircraft from a selected aircraft type for the authenticated user
// @Tags         Aircraft
// @Accept       json
// @Produce      json
// @Param request body fleetpb.CreateAircraftRequest true "Aircraft details"
// @Success      201  {object}  fleetpb.CreateAircraftResponse "Aircraft purchased successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - aircraft type not found"
// @Failure      401  "Unauthorized"
// @Failure      409  "Aircraft tail number conflict"
// @Failure      500  "Internal server error"
// @Router       /aircraft [post]
func (h *FleetHandler) PurchaseAircraft(c *gin.Context) {
	var payload fleetpb.CreateAircraftRequest
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
	payload.CurrentOwnerId = userID.(string)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.fleetClient.CreateAircraft(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrAircraftTypeNotFound) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		if errors.Is(err, customerrors.ErrAircraftTailNumberConflict) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC purchase aircraft, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, response)
}

// ListAircraftTypes godoc
// @Summary      List aircraft types
// @Description  Returns a list of available aircraft types
// @Tags         Aircraft
// @Accept       json
// @Produce      json
// @Success      200  {object}  fleetpb.ListAircraftTypesResponse
// @Failure      500  {object}  dto.ErrorResponse
// @Router       /aircraft-types [get]
func (h *FleetHandler) ListAircraftTypes(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	resp, err := h.fleetClient.ListAircraftTypes(ctx)
	if err != nil {
		log.Println("got error when tried to list aircraft types, ", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// GetAircraftType godoc
// @Summary      Get aircraft type
// @Description  Returns details for a single aircraft type
// @Tags         Aircraft
// @Accept       json
// @Produce      json
// @Param id path string true "Aircraft type id"
// @Success      200  {object}  fleetpb.AircraftType
// @Failure      400  {object}  dto.ErrorResponse
// @Failure      404  {object}  dto.ErrorResponse
// @Failure      500  {object}  dto.ErrorResponse
// @Router       /aircraft-types/{id} [get]
func (h *FleetHandler) GetAircraftType(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	resp, err := h.fleetClient.GetAircraftType(ctx, id)
	if err != nil {
		if errors.Is(err, customerrors.ErrAircraftTypeNotFound) {
			c.JSON(http.StatusNotFound, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		log.Println("got error when tried to get aircraft type, ", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// CreateAircraftType godoc
// @Summary      Create aircraft type
// @Description  Create a new aircraft type (admin only)
// @Tags         Aircraft
// @Accept       json
// @Produce      json
// @Param request body fleetpb.CreateAircraftTypeRequest true "Aircraft type details"
// @Success      201  {object}  fleetpb.AircraftType
// @Failure      400  {object}  dto.ErrorResponse
// @Failure      401  "Unauthorized"
// @Failure      500  {object}  dto.ErrorResponse
// @Router       /aircraft-types [post]
func (h *FleetHandler) CreateAircraftType(c *gin.Context) {
	var payload fleetpb.CreateAircraftTypeRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse create aircraft type payload, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	resp, err := h.fleetClient.CreateAircraftType(ctx, &payload)
	if err != nil {
		log.Println("got error when tried to create aircraft type via gRPC, ", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	c.JSON(http.StatusCreated, resp)
}

// ListAircrafts godoc
// @Summary      List aircrafts for airline
// @Description  Returns list of aircrafts owned by the authenticated airline
// @Tags         Aircraft
// @Accept       json
// @Produce      json
// @Success      200  {object}  fleetpb.ListAircraftsResponse
// @Failure      401  "Unauthorized"
// @Failure      500  {object}  dto.ErrorResponse
// @Router       /aircrafts [get]
func (h *FleetHandler) ListAircrafts(c *gin.Context) {
	userID, exists := c.Get(middleware.UserIDKey)
	if !exists {
		c.Status(http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	resp, err := h.fleetClient.ListAircrafts(ctx, userID.(string))
	if err != nil {
		log.Println("got error when tried to list aircrafts via gRPC, ", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	c.JSON(http.StatusOK, resp)
}
