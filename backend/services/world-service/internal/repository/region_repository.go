package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/google/uuid"
)

type RegionRepository interface {
	CreateRegion(ctx context.Context, payload *worldpb.CreateRegionRequest) (uuid.UUID, error)
	ListRegions(ctx context.Context) ([]*worldpb.Region, error)
	DeleteRegion(ctx context.Context, id uuid.UUID) (bool, error)
}

type regionRepository struct {
	pool db.DBConn
}

func NewRegionRepository(pool db.DBConn) RegionRepository {
	return &regionRepository{pool: pool}
}

func (r *regionRepository) CreateRegion(ctx context.Context, payload *worldpb.CreateRegionRequest) (uuid.UUID, error) {
	query := `
		INSERT INTO region (
			local_code, local_name, intl_name, country_id,
			population, gdp_per_capita, tourism_score, business_score, 
			wikipedia_link
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`

	var regionID uuid.UUID
	err := r.pool.QueryRow(ctx, query, payload.LocalCode, payload.LocalName, payload.IntlName,
		payload.CountryId, payload.Population, payload.GdpPerCapita, payload.TourismScore, payload.BusinessScore,
		payload.WikipediaLink).Scan(&regionID)

	return regionID, err
}

func (r *regionRepository) ListRegions(ctx context.Context) ([]*worldpb.Region, error) {
	query := `
		SELECT
			id::text,
			local_code,
			local_name,
			intl_name,
			country_id::text,
			COALESCE(population, 0),
			COALESCE(gdp_per_capita, 0),
			COALESCE(tourism_score, 0),
			COALESCE(business_score, 0),
			COALESCE(wikipedia_link, '')
		FROM region
		ORDER BY local_name
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	regions := make([]*worldpb.Region, 0)
	for rows.Next() {
		var region worldpb.Region
		if err := rows.Scan(
			&region.Id,
			&region.LocalCode,
			&region.LocalName,
			&region.IntlName,
			&region.CountryId,
			&region.Population,
			&region.GdpPerCapita,
			&region.TourismScore,
			&region.BusinessScore,
			&region.WikipediaLink,
		); err != nil {
			return nil, err
		}

		regions = append(regions, &region)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return regions, nil
}

func (r *regionRepository) DeleteRegion(ctx context.Context, id uuid.UUID) (bool, error) {
	result, err := r.pool.Exec(ctx, `DELETE FROM region WHERE id=$1`, id)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
}
