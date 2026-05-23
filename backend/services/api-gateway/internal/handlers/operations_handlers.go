package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"

	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/dto"
	grpcclient "github.com/404-u-team/airlinesim-mono/backend/api-gateway/internal/grpc"
	operationspb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/operations/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/gin-gonic/gin"
)

type OperationsHandler struct {
	operationsClient *grpcclient.OperationsClient
	config           *config.Config
}

func NewOperationsHandler(operationsClient *grpcclient.OperationsClient, config *config.Config) *OperationsHandler {
	return &OperationsHandler{operationsClient: operationsClient, config: config}
}

// CreateCountry godoc
// @Summary      Create country (admin only)
// @Description  Returns
// @Tags         Country
// @Accept       json
// @Produce      json
// @Param request body operationspb.CreateCountryRequest true "Country details"
// @Success      201  {object}  operationspb.IDResponse "Country created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      409 "Country with such ISO already exists"
// @Failure      500 "Internal server error"
// @Router       /country [post]
func (h *OperationsHandler) CreateCountry(c *gin.Context) {
	// getting payload and validate it
	var payload operationspb.CreateCountryRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	// grpc create country
	IDResponse, err := h.operationsClient.CreateCountry(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrISOConflict) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC create country, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, IDResponse)
}

// ChangeCountry godoc
// @Summary      Change country (admin only)
// @Description  Returns patched country id
// @Tags         Country
// @Accept       json
// @Produce      json
// @Param        id path string true "Country ID"
// @Param        request body operationspb.ChangeCountryRequest true "Country details"
// @Success      200  {object}  operationspb.IDResponse "Country patched successfully"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  "Country not found"
// @Failure      409  "Country conflict"
// @Failure      500  "Internal server error"
// @Router       /country/{id} [put]
func (h *OperationsHandler) ChangeCountry(c *gin.Context) {
	var payload operationspb.ChangeCountryRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}
	payload.Id = c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.ChangeCountry(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrCountryNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		if errors.Is(err, customerrors.ErrISOConflict) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC change country, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// CreateCountry godoc
// @Summary      Create Region (admin only)
// @Description  Returns
// @Tags         Region
// @Accept       json
// @Produce      json
// @Param request body operationspb.CreateRegionRequest true "Region details"
// @Success      201  {object}  dto.IDResponse "Region created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - country with such country_id dont exists"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      409 "Region with such local code already exists"
// @Failure      500 "Internal server error"
// @Router       /region [post]
func (h *OperationsHandler) CreateRegion(c *gin.Context) {
	// getting payload and validate it
	var payload operationspb.CreateRegionRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	// grpc create region
	IDResponse, err := h.operationsClient.CreateRegion(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrNoSuchCountry) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
		}
		if errors.Is(err, customerrors.ErrLocalCodeConflict) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC create region, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, IDResponse)
}

// ChangeRegion godoc
// @Summary      Change region (admin only)
// @Description  Returns patched region id
// @Tags         Region
// @Accept       json
// @Produce      json
// @Param        id path string true "Region ID"
// @Param        request body operationspb.ChangeRegionRequest true "Region details"
// @Success      200  {object}  operationspb.IDResponse "Region patched successfully"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - country not found"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  "Region not found"
// @Failure      409  "Region conflict"
// @Failure      500  "Internal server error"
// @Router       /region/{id} [put]
func (h *OperationsHandler) ChangeRegion(c *gin.Context) {
	var payload operationspb.ChangeRegionRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}
	payload.Id = c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.ChangeRegion(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrRegionNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		if errors.Is(err, customerrors.ErrNoSuchCountry) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		if errors.Is(err, customerrors.ErrLocalCodeConflict) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC change region, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// CreateCountry godoc
// @Summary      Create Region Link (admin only)
// @Description  Returns
// @Tags         Region Link
// @Accept       json
// @Produce      json
// @Param request body operationspb.CreateRegionLinkRequest true "Region Link details"
// @Success      201  {object}  operationspb.IDResponse "Region Link created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - region with such region_id dont exists"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      409 "Region Link with such regions already exists"
// @Failure      500 "Internal server error"
// @Router       /region-link [post]
func (h *OperationsHandler) CreateRegionLink(c *gin.Context) {
	// getting payload and validate it
	var payload operationspb.CreateRegionLinkRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	// set timeout of request
	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	// grpc create region
	IDResponse, err := h.operationsClient.CreateRegionLink(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrNoSuchRegion) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		if errors.Is(err, customerrors.ErrRegionLinkConflict) {
			c.Status(http.StatusConflict)
		}
		log.Println("got error when tried to gRPC create region link, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, IDResponse)
}

// ChangeRegionLink godoc
// @Summary      Change region link (admin only)
// @Description  Returns patched region link id
// @Tags         Region Link
// @Accept       json
// @Produce      json
// @Param        id path string true "Region Link ID"
// @Param        request body operationspb.ChangeRegionLinkRequest true "Region link details"
// @Success      200  {object}  operationspb.IDResponse "Region link patched successfully"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - region not found"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  "Region link not found"
// @Failure      409  "Region link conflict"
// @Failure      500  "Internal server error"
// @Router       /region-link/{id} [put]
func (h *OperationsHandler) ChangeRegionLink(c *gin.Context) {
	var payload operationspb.ChangeRegionLinkRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}
	payload.Id = c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.ChangeRegionLink(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrRegionLinkNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		if errors.Is(err, customerrors.ErrNoSuchRegion) {
			c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 2})
			return
		}
		if errors.Is(err, customerrors.ErrRegionLinkConflict) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC change region link, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// CreateAirport godoc
// @Summary      Create Airport (admin only)
// @Description  Returns
// @Tags         Airport
// @Accept       json
// @Produce      json
// @Param request body operationspb.CreateAirportRequest true "Airport details"
// @Success      201  {object}  operationspb.IDResponse "Airport created successfully, id returned"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - country with such country_id dont exists, 3 - region with such region_id dont exists"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      409  "Airport with such ICAO/IATA already exists"
// @Failure      500 "Internal server error"
// @Router       /airport [post]
func (h *OperationsHandler) CreateAirport(c *gin.Context) {
	var payload operationspb.CreateAirportRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	IDResponse, err := h.operationsClient.CreateAirport(ctx, &payload)
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
		log.Println("got error when tried to gRPC create airport, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusCreated, IDResponse)
}

// ChangeAirport godoc
// @Summary      Change airport (admin only)
// @Description  Returns patched airport id
// @Tags         Airport
// @Accept       json
// @Produce      json
// @Param        id path string true "Airport ID"
// @Param        request body operationspb.ChangeAirportRequest true "Airport details"
// @Success      200  {object}  operationspb.IDResponse "Airport patched successfully"
// @Failure      400  {object}  dto.ErrorResponse "1 - request validation error, 2 - country not found, 3 - region not found"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  "Airport not found"
// @Failure      409  "Airport conflict"
// @Failure      500  "Internal server error"
// @Router       /airport/{id} [put]
func (h *OperationsHandler) ChangeAirport(c *gin.Context) {
	var payload operationspb.ChangeAirportRequest
	if err := c.ShouldBindJSON(&payload); err != nil {
		log.Println("got error when tried to parse, ", err)
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}
	payload.Id = c.Param("id")

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.ChangeAirport(ctx, &payload)
	if err != nil {
		if errors.Is(err, customerrors.ErrAirportNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
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
		log.Println("got error when tried to gRPC change airport, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// ListCountries godoc
// @Summary      List countries
// @Description  Returns all countries
// @Tags         Country
// @Produce      json
// @Success      200  {object}  operationspb.ListCountriesResponse "Countries list"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      500  "Internal server error"
// @Router       /countries [get]
func (h *OperationsHandler) ListCountries(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.ListCountries(ctx)
	if err != nil {
		log.Println("got error when tried to gRPC list countries, ", err)
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
// @Success      200  {object}  operationspb.ListRegionsResponse "Regions list"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      500  "Internal server error"
// @Router       /regions [get]
func (h *OperationsHandler) ListRegions(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.ListRegions(ctx)
	if err != nil {
		log.Println("got error when tried to gRPC list regions, ", err)
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
// @Success      200  {object}  operationspb.ListRegionLinksResponse "Region links list"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      500  "Internal server error"
// @Router       /region-links [get]
func (h *OperationsHandler) ListRegionLinks(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.ListRegionLinks(ctx)
	if err != nil {
		log.Println("got error when tried to gRPC list region links, ", err)
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
// @Success      200  {object}  operationspb.ListAirportsResponse "Airports list"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      500  "Internal server error"
// @Router       /airports [get]
func (h *OperationsHandler) ListAirports(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.ListAirports(ctx)
	if err != nil {
		log.Println("got error when tried to gRPC list airports, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// DeleteCountry godoc
// @Summary      Delete country (admin only)
// @Description  Returns deleted country id
// @Tags         Country
// @Produce      json
// @Param        id path string true "Country ID"
// @Success      200  {object}  operationspb.IDResponse "Country deleted"
// @Failure      400  {object}  dto.ErrorResponse "1 - invalid id"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  "Country not found"
// @Failure      409  "Country has dependencies"
// @Failure      500  "Internal server error"
// @Router       /country/{id} [delete]
func (h *OperationsHandler) DeleteCountry(c *gin.Context) {
	countryID := c.Param("id")
	if countryID == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.DeleteCountry(ctx, &operationspb.DeleteCountryRequest{Id: countryID})
	if err != nil {
		if errors.Is(err, customerrors.ErrCountryNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		if errors.Is(err, customerrors.ErrCountryHasDependencies) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC delete country, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// DeleteRegion godoc
// @Summary      Delete region (admin only)
// @Description  Returns deleted region id
// @Tags         Region
// @Produce      json
// @Param        id path string true "Region ID"
// @Success      200  {object}  operationspb.IDResponse "Region deleted"
// @Failure      400  {object}  dto.ErrorResponse "1 - invalid id"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  "Region not found"
// @Failure      409  "Region has dependencies"
// @Failure      500  "Internal server error"
// @Router       /region/{id} [delete]
func (h *OperationsHandler) DeleteRegion(c *gin.Context) {
	regionID := c.Param("id")
	if regionID == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.DeleteRegion(ctx, &operationspb.DeleteRegionRequest{Id: regionID})
	if err != nil {
		if errors.Is(err, customerrors.ErrRegionNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		if errors.Is(err, customerrors.ErrRegionHasDependencies) {
			c.Status(http.StatusConflict)
			return
		}
		log.Println("got error when tried to gRPC delete region, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// DeleteRegionLink godoc
// @Summary      Delete region link (admin only)
// @Description  Returns deleted region link id
// @Tags         Region Link
// @Produce      json
// @Param        id path string true "Region Link ID"
// @Success      200  {object}  operationspb.IDResponse "Region link deleted"
// @Failure      400  {object}  dto.ErrorResponse "1 - invalid id"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  "Region link not found"
// @Failure      500  "Internal server error"
// @Router       /region-link/{id} [delete]
func (h *OperationsHandler) DeleteRegionLink(c *gin.Context) {
	regionLinkID := c.Param("id")
	if regionLinkID == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.DeleteRegionLink(ctx, &operationspb.DeleteRegionLinkRequest{Id: regionLinkID})
	if err != nil {
		if errors.Is(err, customerrors.ErrRegionLinkNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		log.Println("got error when tried to gRPC delete region link, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}

// DeleteAirport godoc
// @Summary      Delete airport (admin only)
// @Description  Returns deleted airport id
// @Tags         Airport
// @Produce      json
// @Param        id path string true "Airport ID"
// @Success      200  {object}  operationspb.IDResponse "Airport deleted"
// @Failure      400  {object}  dto.ErrorResponse "1 - invalid id"
// @Failure      401  "Unauthorized"
// @Failure      403  "Forbidden"
// @Failure      404  "Airport not found"
// @Failure      500  "Internal server error"
// @Router       /airport/{id} [delete]
func (h *OperationsHandler) DeleteAirport(c *gin.Context) {
	airportID := c.Param("id")
	if airportID == "" {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{ErrorCode: 1})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.config.RequestTimeoutSeconds)
	defer cancel()

	response, err := h.operationsClient.DeleteAirport(ctx, &operationspb.DeleteAirportRequest{Id: airportID})
	if err != nil {
		if errors.Is(err, customerrors.ErrAirportNotFound) {
			c.Status(http.StatusNotFound)
			return
		}
		log.Println("got error when tried to gRPC delete airport, ", err)
		c.Status(http.StatusInternalServerError)
		return
	}

	c.JSON(http.StatusOK, response)
}
