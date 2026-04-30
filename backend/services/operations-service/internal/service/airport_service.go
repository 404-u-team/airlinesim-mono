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

type AirportService interface {
	CreateAirport(ctx context.Context, payload *operationspb.CreateAirportRequest) (*operationspb.IDResponse, error)
	ChangeAirport(ctx context.Context, payload *operationspb.ChangeAirportRequest) (*operationspb.IDResponse, error)
	ListAirports(ctx context.Context) (*operationspb.ListAirportsResponse, error)
	DeleteAirport(ctx context.Context, id string) (*operationspb.IDResponse, error)
}

type airportService struct {
	airportRepo repository.AirportRepository
}

func NewAirportService(airportRepo repository.AirportRepository) AirportService {
	return &airportService{airportRepo: airportRepo}
}

func (s *airportService) CreateAirport(ctx context.Context, payload *operationspb.CreateAirportRequest) (*operationspb.IDResponse, error) {
	airportID, err := s.airportRepo.CreateAirport(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.ConstraintName {
			case "airport_icao_code_key":
				return nil, customerrors.ErrAirportIcaoConflict
			case "airport_iata_code_key":
				return nil, customerrors.ErrAirportIataConflict
			case "airport_country_id_fkey":
				return nil, customerrors.ErrNoSuchCountry
			case "airport_region_id_fkey":
				return nil, customerrors.ErrNoSuchRegion
			}
			if pgErr.Code == "23505" {
				return nil, customerrors.ErrInternal
			}
			if pgErr.Code == "23503" {
				log.Println("got foreign key error in create airport repo, ", pgErr.ConstraintName)
				return nil, customerrors.ErrInternal
			}
		}
		log.Println("got error in create airport repo, ", err)
		return nil, customerrors.ErrInternal
	}

	return &operationspb.IDResponse{Id: airportID.String()}, nil
}

func (s *airportService) ChangeAirport(ctx context.Context, payload *operationspb.ChangeAirportRequest) (*operationspb.IDResponse, error) {
	airportID, err := uuid.Parse(payload.Id)
	if err != nil {
		return nil, customerrors.ErrAirportNotFound
	}

	updated, err := s.airportRepo.ChangeAirport(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			switch pgErr.ConstraintName {
			case "airport_icao_code_key":
				return nil, customerrors.ErrAirportIcaoConflict
			case "airport_iata_code_key":
				return nil, customerrors.ErrAirportIataConflict
			case "airport_country_id_fkey":
				return nil, customerrors.ErrNoSuchCountry
			case "airport_region_id_fkey":
				return nil, customerrors.ErrNoSuchRegion
			}
		}
		log.Println("got error in patch airport repo, ", err)
		return nil, customerrors.ErrInternal
	}
	if !updated {
		return nil, customerrors.ErrAirportNotFound
	}

	return &operationspb.IDResponse{Id: airportID.String()}, nil
}

func (s *airportService) ListAirports(ctx context.Context) (*operationspb.ListAirportsResponse, error) {
	airports, err := s.airportRepo.ListAirports(ctx)
	if err != nil {
		log.Println("got error in list airports repo, ", err)
		return nil, customerrors.ErrInternal
	}

	return &operationspb.ListAirportsResponse{Airports: airports}, nil
}

func (s *airportService) DeleteAirport(ctx context.Context, id string) (*operationspb.IDResponse, error) {
	airportID, err := uuid.Parse(id)
	if err != nil {
		return nil, customerrors.ErrAirportNotFound
	}

	deleted, err := s.airportRepo.DeleteAirport(ctx, airportID)
	if err != nil {
		log.Println("got error in delete airport repo, ", err)
		return nil, customerrors.ErrInternal
	}
	if !deleted {
		return nil, customerrors.ErrAirportNotFound
	}

	return &operationspb.IDResponse{Id: airportID.String()}, nil
}
