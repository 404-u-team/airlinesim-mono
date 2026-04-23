package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/google/uuid"
)

type RegionRepository interface {
	CreateRegion(ctx context.Context, payload *worldpb.CreateRegionRequest) (uuid.UUID, error)
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
