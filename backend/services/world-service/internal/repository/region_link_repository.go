package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/google/uuid"
)

type RegionLinkRepository interface {
	CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (uuid.UUID, error)
	ListRegionLinks(ctx context.Context) ([]*worldpb.RegionLink, error)
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

func (r *regionLinkRepository) ListRegionLinks(ctx context.Context) ([]*worldpb.RegionLink, error) {
	query := `
		SELECT
			id::text,
			region_a::text,
			region_b::text,
			COALESCE(diaspora, 0),
			COALESCE(business, 0),
			COALESCE(tourism, 0)
		FROM region_link
		ORDER BY id
	`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	regionLinks := make([]*worldpb.RegionLink, 0)
	for rows.Next() {
		var regionLink worldpb.RegionLink
		if err := rows.Scan(
			&regionLink.Id,
			&regionLink.RegionA,
			&regionLink.RegionB,
			&regionLink.Diaspora,
			&regionLink.Business,
			&regionLink.Tourism,
		); err != nil {
			return nil, err
		}

		regionLinks = append(regionLinks, &regionLink)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return regionLinks, nil
}
