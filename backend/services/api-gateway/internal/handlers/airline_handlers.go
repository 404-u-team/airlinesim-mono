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
// @Param request body dto.CreateAirlineRequestDTO true "Airline details (owner_id taken from token)"
// @Success      201  {object}  airlinepb.CreateAirlineResponse "Airline created successfully"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - airport not found, 3 - user not found"
// @Failure      401  "Unauthorized"
// @Failure      409  "Airline conflict"
// @Failure      500  "Internal server error"
// @Router       /airline [post]
func (h *AirlineHandler) CreateAirline(c *gin.Context) {
	var payload dto.CreateAirlineRequestDTO
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

	pbPayload := airlinepb.CreateAirlineRequest{
		OwnerId:           userID.(string),
		StartingAirportId: payload.StartingAirportId,
		Name:              payload.Name,
		IataCode:          payload.IataCode,
		IcaoCode:          payload.IcaoCode,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.airlineClient.CreateAirline(ctx, &pbPayload)
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

// GetMyAirline godoc
// @Summary      Get my airline
// @Description  Returns full airline information for the authenticated user
// @Tags         Airline
// @Produce      json
// @Success      200  {object}  airlinepb.AirlineResponse "Airline information"
// @Failure      401  "Unauthorized"
// @Failure      404  "Airline not found"
// @Failure      500  "Internal server error"
// @Router       /airline/me [get]
func (h *AirlineHandler) GetMyAirline(c *gin.Context) {
	userID, exists := c.Get(middleware.UserIDKey)
	if !exists {
		c.Status(http.StatusUnauthorized)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.airlineClient.GetAirlineByOwnerID(ctx, &airlinepb.GetAirlineByOwnerIDRequest{OwnerId: userID.(string)})
	if err != nil {
		if errors.Is(err, customerrors.ErrAirlineNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		log.Println("got error when tried to gRPC get my airline, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetAirlineByID godoc
// @Summary      Get airline by id
// @Description  Returns full airline information by airline id
// @Tags         Airline
// @Produce      json
// @Param       id path string true "Airline ID"
// @Success      200  {object}  airlinepb.AirlineResponse "Airline information"
// @Failure      401  "Unauthorized"
// @Failure      404  "Airline not found"
// @Failure      500  "Internal server error"
// @Router       /airline/{id} [get]
func (h *AirlineHandler) GetAirlineByID(c *gin.Context) {
	airlineID := c.Param("id")
	if airlineID == "" {
		c.Status(http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.airlineClient.GetAirlineByID(ctx, &airlinepb.GetAirlineByIDRequest{Id: airlineID})
	if err != nil {
		if errors.Is(err, customerrors.ErrAirlineNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		log.Println("got error when tried to gRPC get airline by id, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// UpdateAirline godoc
// @Summary      Update airline
// @Description  Update airline name and codes (iata, icao). Only owner or admin allowed.
// @Tags         Airline
// @Accept       json
// @Produce      json
// @Param id path string true "Airline ID"
// @Param request body object true "Fields to update: name, iata_code, icao_code"
// @Success      200  {object}  airlinepb.AirlineResponse
// @Failure      400  {object}  dto.ErrorResponse
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  {object}  dto.ErrorResponse
// @Failure      409  "Conflict"
// @Failure      500  {object}  dto.ErrorResponse
// @Router       /airline/{id} [patch]
func (h *AirlineHandler) UpdateAirline(c *gin.Context) {
	airlineID := c.Param("id")
	if airlineID == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	var payload struct {
		Name     string `json:"name"`
		IataCode string `json:"iata_code"`
		IcaoCode string `json:"icao_code"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	userID, exists := c.Get(middleware.UserIDKey)
	if !exists {
		c.Status(http.StatusUnauthorized)
		return
	}

	role, _ := c.Get(middleware.RoleKey)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	// Ensure owner or admin
	existing, err := h.airlineClient.GetAirlineByID(ctx, &airlinepb.GetAirlineByIDRequest{Id: airlineID})
	if err != nil {
		if errors.Is(err, customerrors.ErrAirlineNotFound) {
			c.JSON(http.StatusNotFound, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		log.Println("got error when tried to gRPC get airline by id before update, ", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	if role != "admin" && existing.OwnerId != userID.(string) {
		c.Status(http.StatusForbidden)
		return
	}

	// Call update
	updateReq := &airlinepb.UpdateAirlineRequest{Id: airlineID, Name: payload.Name, IataCode: payload.IataCode, IcaoCode: payload.IcaoCode}
	resp, err := h.airlineClient.UpdateAirline(ctx, updateReq)
	if err != nil {
		if errors.Is(err, customerrors.ErrAirlineNameConflict) || errors.Is(err, customerrors.ErrAirlineIataConflict) || errors.Is(err, customerrors.ErrAirlineIcaoConflict) {
			c.Status(http.StatusConflict)
			return
		}
		if errors.Is(err, customerrors.ErrAirlineNotFound) {
			c.JSON(http.StatusNotFound, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		log.Println("got error when tried to gRPC update airline, ", err)
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	c.JSON(http.StatusOK, resp)
}
