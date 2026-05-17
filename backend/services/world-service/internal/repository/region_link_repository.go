package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/google/uuid"
)

type RegionLinkRepository interface {
	CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (uuid.UUID, error)
	ChangeRegionLink(ctx context.Context, payload *worldpb.ChangeRegionLinkRequest) (bool, error)
	ListRegionLinks(ctx context.Context) ([]*worldpb.RegionLink, error)
	DeleteRegionLink(ctx context.Context, id uuid.UUID) (bool, error)
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

func (r *regionLinkRepository) ChangeRegionLink(ctx context.Context, payload *worldpb.ChangeRegionLinkRequest) (bool, error) {
	result, err := r.pool.Exec(ctx, `
		UPDATE region_link
		SET region_a=$2, region_b=$3, diaspora=$4, business=$5, tourism=$6
		WHERE id=$1
	`, payload.Id, payload.RegionA, payload.RegionB, payload.Diaspora, payload.Business, payload.Tourism)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
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

func (r *regionLinkRepository) DeleteRegionLink(ctx context.Context, id uuid.UUID) (bool, error) {
	result, err := r.pool.Exec(ctx, `DELETE FROM region_link WHERE id=$1`, id)
	if err != nil {
		return false, err
	}

	return result.RowsAffected() > 0, nil
}
