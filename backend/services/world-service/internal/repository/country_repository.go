package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/google/uuid"
)

type CountryRepository interface {
	CreateCountry(ctx context.Context, payload *worldpb.CreateCountryRequest) (uuid.UUID, error)
	ChangeCountry(ctx context.Context, payload *worldpb.ChangeCountryRequest) (bool, error)
	ListCountries(ctx context.Context) ([]*worldpb.Country, error)
	DeleteCountry(ctx context.Context, id uuid.UUID) (bool, error)
}

type countryRepository struct {
	pool db.DBConn
}

func NewCountryRepository(pool db.DBConn) CountryRepository {
	return &countryRepository{pool: pool}
}

func (r *countryRepository) CreateCountry(ctx context.Context, payload *worldpb.CreateCountryRequest) (uuid.UUID, error) {
	query := `
		INSERT INTO country (
			iso, local_name, intl_name, flythrough_permission_price,
			land_permission_price, corp_tax_rate, vat_rate, aircraft_tail_code, 
			wikipedia_link
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`

	var countryID uuid.UUID
	err := r.pool.QueryRow(ctx, query, payload.Iso, payload.LocalName, payload.IntlName, payload.FlythroughPermissionPrice,
		payload.LandPermissionPrice, payload.CorpTaxRate, payload.VatRate, payload.AircraftTailCode,
		payload.WikipediaLink).Scan(&countryID)

	return countryID, err
}

func (r *countryRepository) ChangeCountry(ctx context.Context, payload *worldpb.ChangeCountryRequest) (bool, error) {
	result, err := r.pool.Exec(ctx, `
		UPDATE country
		SET iso=$2, local_name=$3, intl_name=$4, flythrough_permission_price=$5,
			land_permission_price=$6, corp_tax_rate=$7, vat_rate=$8, aircraft_tail_code=$9,
			wikipedia_link=$10
		WHERE id=$1
	`, payload.Id, payload.Iso, payload.LocalName, payload.IntlName, payload.FlythroughPermissionPrice,
		payload.LandPermissionPrice, payload.CorpTaxRate, payload.VatRate, payload.AircraftTailCode,
		payload.WikipediaLink)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
}

func (r *countryRepository) ListCountries(ctx context.Context) ([]*worldpb.Country, error) {
	query := `
		SELECT
			id::text,
			iso,
			local_name,
			intl_name,
			COALESCE(flythrough_permission_price, 0),
			COALESCE(land_permission_price, 0),
			COALESCE(corp_tax_rate, 0),
			COALESCE(vat_rate, 0),
			COALESCE(aircraft_tail_code, ''),
			COALESCE(wikipedia_link, '')
		FROM country
		ORDER BY local_name
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	countries := make([]*worldpb.Country, 0)
	for rows.Next() {
		var country worldpb.Country
		if err := rows.Scan(
			&country.Id,
			&country.Iso,
			&country.LocalName,
			&country.IntlName,
			&country.FlythroughPermissionPrice,
			&country.LandPermissionPrice,
			&country.CorpTaxRate,
			&country.VatRate,
			&country.AircraftTailCode,
			&country.WikipediaLink,
		); err != nil {
			return nil, err
		}

		countries = append(countries, &country)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return countries, nil
}

func (r *countryRepository) DeleteCountry(ctx context.Context, id uuid.UUID) (bool, error) {
	result, err := r.pool.Exec(ctx, `DELETE FROM country WHERE id=$1`, id)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
}
