package service

import (
	"context"
	"errors"
	"log"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/repository"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type RegionLinkService interface {
	CreateRegionLink(ctx context.Context, payload *worldpb.CreateRegionLinkRequest) (*worldpb.IDResponse, error)
	ChangeRegionLink(ctx context.Context, payload *worldpb.ChangeRegionLinkRequest) (*worldpb.IDResponse, error)
	ListRegionLinks(ctx context.Context) (*worldpb.ListRegionLinksResponse, error)
	DeleteRegionLink(ctx context.Context, id string) (*worldpb.IDResponse, error)
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

func (s *regionLinkService) ChangeRegionLink(ctx context.Context, payload *worldpb.ChangeRegionLinkRequest) (*worldpb.IDResponse, error) {
	regionLinkID, err := uuid.Parse(payload.Id)
	if err != nil {
		return nil, customerrors.ErrRegionLinkNotFound
	}

	updated, err := s.regionLinkRepo.ChangeRegionLink(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, customerrors.ErrRegionLinkConflict
		}
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return nil, customerrors.ErrNoSuchRegion
		}
		log.Println("got error in patch region link repo, ", err)
		return nil, customerrors.ErrInternal
	}
	if !updated {
		return nil, customerrors.ErrRegionLinkNotFound
	}

	return &worldpb.IDResponse{Id: regionLinkID.String()}, nil
}

func (s *regionLinkService) ListRegionLinks(ctx context.Context) (*worldpb.ListRegionLinksResponse, error) {
	regionLinks, err := s.regionLinkRepo.ListRegionLinks(ctx)
	if err != nil {
		log.Println("got error in list region links repo, ", err)
		return nil, customerrors.ErrInternal
	}

	return &worldpb.ListRegionLinksResponse{RegionLinks: regionLinks}, nil
}

func (s *regionLinkService) DeleteRegionLink(ctx context.Context, id string) (*worldpb.IDResponse, error) {
	regionLinkID, err := uuid.Parse(id)
	if err != nil {
		return nil, customerrors.ErrRegionLinkNotFound
	}

	deleted, err := s.regionLinkRepo.DeleteRegionLink(ctx, regionLinkID)
	if err != nil {
		log.Println("got error in delete region link repo, ", err)
		return nil, customerrors.ErrInternal
	}
	if !deleted {
		return nil, customerrors.ErrRegionLinkNotFound
	}

	return &worldpb.IDResponse{Id: regionLinkID.String()}, nil
}
