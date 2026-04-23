package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/dto"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
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
// @Param request body worldpb.CreateCountryRequest true "Country details"
// @Success      201  {object}  worldpb.IDResponse "Country created successfully, id returned"
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

// CreateCountry godoc
// @Summary      Create Region (admin only)
// @Description  Returns
// @Tags         Region
// @Accept       json
// @Produce      json
// @Param request body worldpb.CreateRegionRequest true "Region details"
// @Success      201  {object}  dto.IDResponse "Region created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - country with such country_id dont exists"
// @Failure      409 "Region with such local code already exists"
// @Failure      500 "Internal server error"
// @Router       /region [post]
func (h *WorldHandler) CreateRegion(c *gin.Context) {
	// getting payload and validate it
	var payload worldpb.CreateRegionRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	// grpc create region
	IDResponse, err := h.worldClient.CreateRegion(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrNoSuchCountry) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
		}
		if errors.Is(err, customerrors.ErrLocalCodeConflict) {
			c.Status(http.StatusConflict)
			return
		}
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, IDResponse)
}

// CreateCountry godoc
// @Summary      Create Region Link (admin only)
// @Description  Returns
// @Tags         Region Link
// @Accept       json
// @Produce      json
// @Param request body worldpb.CreateRegionLinkRequest true "Region Link details"
// @Success      201  {object}  worldpb.IDResponse "Region Link created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - region with such region_id dont exists"
// @Failure      409 "Region Link with such regions already exists"
// @Failure      500 "Internal server error"
// @Router       /region-link [post]
func (h *WorldHandler) CreateRegionLink(c *gin.Context) {
	// getting payload and validate it
	var payload worldpb.CreateRegionLinkRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	// grpc create region
	IDResponse, err := h.worldClient.CreateRegionLink(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrNoSuchRegion) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		if errors.Is(err, customerrors.ErrRegionLinkConflict) {
			c.Status(http.StatusConflict)
		}
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, IDResponse)
}

// CreateAirport godoc
// @Summary      Create Airport (admin only)
// @Description  Returns
// @Tags         Airport
// @Accept       json
// @Produce      json
// @Param request body worldpb.CreateAirportRequest true "Airport details"
// @Success      201  {object}  worldpb.IDResponse "Airport created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - country with such country_id dont exists, 3 - region with such region_id dont exists"
// @Failure      409  "Airport with such ICAO/IATA already exists"
// @Failure      500  "Internal server error"
// @Router       /airport [post]
func (h *WorldHandler) CreateAirport(c *gin.Context) {
	var payload worldpb.CreateAirportRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	IDResponse, err := h.worldClient.CreateAirport(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrNoSuchCountry) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		if errors.Is(err, customerrors.ErrNoSuchRegion) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 3})
			return
		}
		if errors.Is(err, customerrors.ErrAirportIcaoConflict) || errors.Is(err, customerrors.ErrAirportIataConflict) {
			c.Status(http.StatusConflict)
			return
		}
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, IDResponse)
}

// ListCountries godoc
// @Summary      List countries
// @Description  Returns all countries
// @Tags         Country
// @Produce      json
// @Success      200  {object}  worldpb.ListCountriesResponse "Countries list"
// @Failure      500  "Internal server error"
// @Router       /countries [get]
func (h *WorldHandler) ListCountries(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.worldClient.ListCountries(ctx)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// ListRegions godoc
// @Summary      List regions
// @Description  Returns all regions
// @Tags         Region
// @Produce      json
// @Success      200  {object}  worldpb.ListRegionsResponse "Regions list"
// @Failure      500  "Internal server error"
// @Router       /regions [get]
func (h *WorldHandler) ListRegions(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.worldClient.ListRegions(ctx)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// ListRegionLinks godoc
// @Summary      List region links
// @Description  Returns all region links
// @Tags         Region Link
// @Produce      json
// @Success      200  {object}  worldpb.ListRegionLinksResponse "Region links list"
// @Failure      500  "Internal server error"
// @Router       /region-links [get]
func (h *WorldHandler) ListRegionLinks(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.worldClient.ListRegionLinks(ctx)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// ListAirports godoc
// @Summary      List airports
// @Description  Returns all airports
// @Tags         Airport
// @Produce      json
// @Success      200  {object}  worldpb.ListAirportsResponse "Airports list"
// @Failure      500  "Internal server error"
// @Router       /airports [get]
func (h *WorldHandler) ListAirports(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
	defer cancel()

	response, err := h.worldClient.ListAirports(ctx)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}
