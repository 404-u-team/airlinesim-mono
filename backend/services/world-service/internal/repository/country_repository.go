package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/dto"
)

type CountryRepository interface {
	CreateCountry(ctx context.Context, payload *dto.CreateCountryRequest) error
}

type countryRepository struct {
	pool db.DBConn
}

func NewCountryRepository(pool db.DBConn) CountryRepository {
	return &countryRepository{pool: pool}
}

func (r *countryRepository) CreateCountry(ctx context.Context, payload *dto.CreateCountryRequest) error {
	query := `
		INSERT INTO country (
			iso, local_name, intl_name, flythrough_permission_pricem,
			land_permission_price, corp_tax_rate, vat_rate, aircraft_tail_code, 
			wikipedia_link
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := r.pool.Exec(ctx, query, payload.ISO, payload.LocalName, payload.IntlName, payload.FlythroughPermissionPrice,
		payload.LandPermissionPrice, payload.CorpTaxRate, payload.VatRate, payload.AircraftTailCode,
		payload.WikipediaLink)

	return err
}
