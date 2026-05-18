package service

import (
	"context"
	"errors"
	"log"

	customerrors "github.com/404-u-team/airlinesim-mono/backend/game-service/internal/errors"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/repository"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"github.com/jackc/pgx/v5/pgconn"
)

type WorldService interface {
	CreateCountry(ctx context.Context, payload *worldpb.CreateCountryRequest) (*worldpb.IDResponse, error)
}

type worldService struct {
	countryRepo repository.CountryRepository
}

func NewWorldService(countryRepo repository.CountryRepository) WorldService {
	return &worldService{countryRepo: countryRepo}
}

func (s *worldService) CreateCountry(ctx context.Context, payload *worldpb.CreateCountryRequest) (*worldpb.IDResponse, error) {
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
