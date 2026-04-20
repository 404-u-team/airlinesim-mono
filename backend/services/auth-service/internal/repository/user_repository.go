package repository

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/dto"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type UserRepository interface {
	CreateUser(ctx context.Context, payload *authpb.RegisterRequest, role string) (uuid.UUID, error)
	GetUserByEmail(ctx context.Context, email string) (*dto.User, error)
	GetUserByNickname(ctx context.Context, nickname string) (*dto.User, error)
	IsUserExists(ctx context.Context, userID uuid.UUID) (bool, error)
}

type DBConn interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type userRepository struct {
	pool DBConn
}

func NewUserRepository(pool DBConn) UserRepository {
	return &userRepository{pool: pool}
}

// creates user, using default role - 'user'
func (r *userRepository) CreateUser(ctx context.Context, payload *authpb.RegisterRequest, role string) (uuid.UUID, error) {
	query := `
		INSERT INTO users (email, nickname, password_hashed, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`

	var userID uuid.UUID
	err := r.pool.QueryRow(ctx, query, payload.Email, payload.Nickname, payload.Password, role).
		Scan(&userID)

	return userID, err
}

// returns *dto.User with userID and password hash
func (r *userRepository) GetUserByEmail(ctx context.Context, email string) (*dto.User, error) {
	query := `
		SELECT id, password_hashed, role
        FROM users WHERE email=$1	
	`
	var user dto.User
	err := r.pool.QueryRow(ctx, query, email).
		Scan(&user.ID, &user.PasswordHash, &user.Role)

	return &user, err
}

// returns *dto.User with userID and password hash
func (r *userRepository) IsUserExists(ctx context.Context, userID uuid.UUID) (bool, error) {
	query := `
		SELECT EXISTS(
			SELECT 1
			FROM users WHERE id=$1
		)
	`
	var exists bool
	err := r.pool.QueryRow(ctx, query, userID).
		Scan(&exists)

	return exists, err
}

// returns *dto.User with userID and password hash
func (r *userRepository) GetUserByNickname(ctx context.Context, nickname string) (*dto.User, error) {
	query := `
		SELECT id, password_hashed, role
        FROM users WHERE nickname=$1	
	`
	var user dto.User
	err := r.pool.QueryRow(ctx, query, nickname).
		Scan(&user.ID, &user.PasswordHash, &user.Role)

	return &user, err
}
