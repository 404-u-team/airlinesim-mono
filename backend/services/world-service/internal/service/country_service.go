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

type CountryService interface {
	CreateCountry(ctx context.Context, payload *worldpb.CreateCountryRequest) (*worldpb.IDResponse, error)
	ChangeCountry(ctx context.Context, payload *worldpb.ChangeCountryRequest) (*worldpb.IDResponse, error)
	ListCountries(ctx context.Context) (*worldpb.ListCountriesResponse, error)
	DeleteCountry(ctx context.Context, id string) (*worldpb.IDResponse, error)
}

type countryService struct {
	countryRepo repository.CountryRepository
}

func NewCountryService(countryRepo repository.CountryRepository) CountryService {
	return &countryService{countryRepo: countryRepo}
}

func (s *countryService) CreateCountry(ctx context.Context, payload *worldpb.CreateCountryRequest) (*worldpb.IDResponse, error) {
	countryID, err := s.countryRepo.CreateCountry(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, customerrors.ErrISOConflict
		}
		log.Println("got error in create country repo, ", err)
		return nil, customerrors.ErrInternal
	}

	IDResponse := &worldpb.IDResponse{Id: countryID.String()}
	return IDResponse, nil
}

func (s *countryService) ChangeCountry(ctx context.Context, payload *worldpb.ChangeCountryRequest) (*worldpb.IDResponse, error) {
	countryID, err := uuid.Parse(payload.Id)
	if err != nil {
		return nil, customerrors.ErrCountryNotFound
	}

	updated, err := s.countryRepo.ChangeCountry(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, customerrors.ErrISOConflict
		}
		log.Println("got error in patch country repo, ", err)
		return nil, customerrors.ErrInternal
	}
	if !updated {
		return nil, customerrors.ErrCountryNotFound
	}

	return &worldpb.IDResponse{Id: countryID.String()}, nil
}

func (s *countryService) ListCountries(ctx context.Context) (*worldpb.ListCountriesResponse, error) {
	countries, err := s.countryRepo.ListCountries(ctx)
	if err != nil {
		log.Println("got error in list countries repo, ", err)
		return nil, customerrors.ErrInternal
	}

	return &worldpb.ListCountriesResponse{Countries: countries}, nil
}

func (s *countryService) DeleteCountry(ctx context.Context, id string) (*worldpb.IDResponse, error) {
	countryID, err := uuid.Parse(id)
	if err != nil {
		return nil, customerrors.ErrCountryNotFound
	}

	deleted, err := s.countryRepo.DeleteCountry(ctx, countryID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return nil, customerrors.ErrCountryHasDependencies
		}
		log.Println("got error in delete country repo, ", err)
		return nil, customerrors.ErrInternal
	}
	if !deleted {
		return nil, customerrors.ErrCountryNotFound
	}

	return &worldpb.IDResponse{Id: countryID.String()}, nil
}
