package repository

import (
	"context"
	"log"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/db"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/dto"
)

type CountryRepository interface {
	CreateCountry(ctx context.Context, payload *dto.CreateCountryRequest) error
}

type countryRepository struct {
	pool db.DBConn
}

func NewCountryRepository(pool db.DBConn) CountryRepository {
	return &countryRepository{pool: pool}
}

func (r *countryRepository) CreateCountry(ctx context.Context, payload *dto.CreateCountryRequest) error {
	log.Println("created country with iso: ", payload.ISO)
	return nil
	// query := `
	// 	INSERT INTO users (email, nickname, password_hashed)
	// 	VALUES ($1, $2, $3)
	// 	RETURNING id
	// `

	// var userID uuid.UUID
	// err := r.pool.QueryRow(ctx, query, payload.Email, payload.Nickname, payload.Password).
	// 	Scan(&userID)

	// return userID, err
}
