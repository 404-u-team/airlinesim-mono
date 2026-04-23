package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/google/uuid"
)

type RegionLinkRepository interface {
	CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (uuid.UUID, error)
}

type regionLinkRepository struct {
	pool db.DBConn
}

func NewRegionLinkRepository(pool db.DBConn) RegionLinkRepository {
	return &regionLinkRepository{pool: pool}
}

func (r *regionLinkRepository) CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (uuid.UUID, error) {
	query := `
		INSERT INTO region (
			region_a, region_b, diaspora, 
            business, tourism,
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`

	var regionLinkID uuid.UUID
	err := r.pool.QueryRow(ctx, query, payload.RegionA, payload.RegionB,
		payload.Diaspora, payload.Business, payload.Tourism).Scan(&regionLinkID)

	return regionLinkID, err
}
