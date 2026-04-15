package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/dto"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository interface {
	CreateUser(ctx context.Context, payload *authpb.RegisterRequest) (uuid.UUID, error)
	GetUserByEmail(ctx context.Context, email string) (*dto.User, error)
	GetUserByNickname(ctx context.Context, nickname string) (*dto.User, error)
}

type userRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) UserRepository {
	return &userRepository{pool: pool}
}

// creates user, using default role - 'user'
func (r *userRepository) CreateUser(ctx context.Context, payload *authpb.RegisterRequest) (uuid.UUID, error) {
	query := `
		INSERT INTO users (email, nickname, password_hashed)
		VALUES ($1, $2, $3)
		RETURNING id
	`

	var userID uuid.UUID
	err := r.pool.QueryRow(ctx, query, payload.Email, payload.Nickname, payload.Password).
		Scan(&userID)

	return userID, err
}

// returns *dto.User with userID and password hash
func (r *userRepository) GetUserByEmail(ctx context.Context, email string) (*dto.User, error) {
	query := `
		SELECT id, password_hashed
        FROM users WHERE email=$1	
	`
	var user dto.User
	err := r.pool.QueryRow(ctx, query, email).
		Scan(&user.ID, &user.PasswordHash)

	return &user, err
}

// returns *dto.User with userID and password hash
func (r *userRepository) GetUserByNickname(ctx context.Context, nickname string) (*dto.User, error) {
	query := `
		SELECT id, password_hashed
        FROM users WHERE nickname=$1	
	`
	var user dto.User
	err := r.pool.QueryRow(ctx, query, nickname).
		Scan(&user.ID, &user.PasswordHash)

	return &user, err
}
