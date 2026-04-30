package service

import (
	"context"
	"errors"
	"log"

	"github.com/404-u-team/airlinesim-mono/backend/operations-service/internal/repository"
	operationspb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/operations/v1"
	"github.com/404-u-team/airlinesim-mono/backend/shared/customerrors"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type RegionService interface {
	CreateRegion(ctx context.Context, payload *operationspb.CreateRegionRequest) (*operationspb.IDResponse, error)
	ChangeRegion(ctx context.Context, payload *operationspb.ChangeRegionRequest) (*operationspb.IDResponse, error)
	ListRegions(ctx context.Context) (*operationspb.ListRegionsResponse, error)
	DeleteRegion(ctx context.Context, id string) (*operationspb.IDResponse, error)
}

type regionService struct {
	regionRepo repository.RegionRepository
}

func NewRegionService(regionRepo repository.RegionRepository) RegionService {
	return &regionService{regionRepo: regionRepo}
}

func (s *regionService) CreateRegion(ctx context.Context, payload *operationspb.CreateRegionRequest) (*operationspb.IDResponse, error) {
	regionID, err := s.regionRepo.CreateRegion(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if pgErr.Code == "23505" {
				return nil, customerrors.ErrLocalCodeConflict
			}
			if pgErr.Code == "23503" {
				return nil, customerrors.ErrNoSuchCountry
			}
			log.Println("got unexpected pgErr code in create region repo, ", pgErr.Code)
		}
		log.Println("got error in create region repo, ", err)
		return nil, customerrors.ErrInternal
	}

	IDResponse := &operationspb.IDResponse{Id: regionID.String()}
	return IDResponse, nil
}

func (s *regionService) ChangeRegion(ctx context.Context, payload *operationspb.ChangeRegionRequest) (*operationspb.IDResponse, error) {
	regionID, err := uuid.Parse(payload.Id)
	if err != nil {
		return nil, customerrors.ErrRegionNotFound
	}

	updated, err := s.regionRepo.ChangeRegion(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			if pgErr.Code == "23505" {
				return nil, customerrors.ErrLocalCodeConflict
			}
			if pgErr.Code == "23503" {
				return nil, customerrors.ErrNoSuchCountry
			}
		}
		log.Println("got error in patch region repo, ", err)
		return nil, customerrors.ErrInternal
	}
	if !updated {
		return nil, customerrors.ErrRegionNotFound
	}

	return &operationspb.IDResponse{Id: regionID.String()}, nil
}

func (s *regionService) ListRegions(ctx context.Context) (*operationspb.ListRegionsResponse, error) {
	regions, err := s.regionRepo.ListRegions(ctx)
	if err != nil {
		log.Println("got error in list regions repo, ", err)
		return nil, customerrors.ErrInternal
	}

	return &operationspb.ListRegionsResponse{Regions: regions}, nil
}

func (s *regionService) DeleteRegion(ctx context.Context, id string) (*operationspb.IDResponse, error) {
	regionID, err := uuid.Parse(id)
	if err != nil {
		return nil, customerrors.ErrRegionNotFound
	}

	deleted, err := s.regionRepo.DeleteRegion(ctx, regionID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return nil, customerrors.ErrRegionHasDependencies
		}
		log.Println("got error in delete region repo, ", err)
		return nil, customerrors.ErrInternal
	}
	if !deleted {
		return nil, customerrors.ErrRegionNotFound
	}

	return &operationspb.IDResponse{Id: regionID.String()}, nil
}
