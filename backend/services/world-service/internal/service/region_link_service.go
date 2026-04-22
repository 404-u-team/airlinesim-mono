package service

import (
	"context"
	"errors"
	"log"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/repository"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/jackc/pgx/v5/pgconn"
)

type RegionLinkService interface {
	CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (*worldpb.IDResponse, error)
}

type regionLinkService struct {
	regionLinkRepo repository.RegionLinkRepository
}

func NewRegionLinkService(regionLinkRepo repository.RegionLinkRepository) RegionLinkService {
	return &regionLinkService{regionLinkRepo: regionLinkRepo}
}

func (s *regionLinkService) CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (*worldpb.IDResponse, error) {
	regionLinkID, err := s.regionLinkRepo.CreateRegionLink(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if pgErr.Code == "23505" {
				return nil, customerrors.ErrRegionLinkConflict
			}
			if pgErr.Code == "23503" {
				return nil, customerrors.ErrNoSuchRegion
			}
			log.Println("got unexpected pgErr code in create region link repo, ", pgErr.Code)
		}
		log.Println("got error in create region link repo, ", err)
		return nil, customerrors.ErrInternal
	}

	IDResponse := &worldpb.IDResponse{Id: regionLinkID.String()}
	return IDResponse, nil
}
