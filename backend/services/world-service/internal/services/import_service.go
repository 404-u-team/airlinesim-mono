package services

import (
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/repository"
)

type ImportService interface {
}

type importService struct {
	countryRepo repository.CountryRepository
}

func NewImportService(countryRepo repository.CountryRepository) ImportService {
	return &importService{countryRepo: countryRepo}
}
