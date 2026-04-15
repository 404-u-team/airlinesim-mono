package service

import (
	"context"
	"errors"
	"log"
	"strings"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/auth"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/dto"
	grpcerrors "github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/errors"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/repository"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type AuthService interface {
	Register(ctx context.Context, payload *authpb.RegisterRequest, config *config.Config) (*authpb.TokenResponse, error)
	Login(ctx context.Context, payload *authpb.LoginRequest, config *config.Config) (*authpb.TokenResponse, error)
	RefreshToken(ctx context.Context, payload *authpb.RefreshTokenRequest, config *config.Config) (*authpb.TokenResponse, error)
}

type authService struct {
	repo repository.UserRepository
}

func NewAuthService(repo repository.UserRepository) *authService {
	return &authService{repo: repo}
}

func (s *authService) Register(ctx context.Context, payload *authpb.RegisterRequest, config *config.Config) (*authpb.TokenResponse, error) {
	// hash password and put it in payload
	hashedPassword, err := auth.HashPassword(payload.Password)
	if err != nil {
		log.Println("error when tried to hash password, ", err)
		return nil, grpcerrors.ErrInternal
	}
	payload.Password = hashedPassword

	// create user
	userID, err := s.repo.CreateUser(ctx, payload)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			// unique constraint violation
			if pgErr.ConstraintName == "users_email_key" {
				return nil, grpcerrors.ErrUserWithSuchEmailExists
			}
			if pgErr.ConstraintName == "users_nickname_key" {
				return nil, grpcerrors.ErrUserWithSuchNicknameExists
			}
		}
		return nil, grpcerrors.ErrInternal
	}

	// create tokens. we using role 'user' because it is default role for created user
	tokenResponse, err := getTokenResponse(userID, "user", config)
	if err != nil {
		return nil, grpcerrors.ErrInternal
	}

	return tokenResponse, nil
}

func (s *authService) Login(ctx context.Context, payload *authpb.LoginRequest, config *config.Config) (*authpb.TokenResponse, error) {
	// check how should we get user (via nickname or email) and get userID, password
	var (
		user *dto.User
		err  error
	)
	if strings.Contains(payload.Login, "@") {
		user, err = s.repo.GetUserByEmail(ctx, payload.Login)
	} else {
		user, err = s.repo.GetUserByNickname(ctx, payload.Login)
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, grpcerrors.ErrUserNotFound
		}
		return nil, grpcerrors.ErrInternal
	}

	// compare password
	if !auth.ComparePasswords(user.PasswordHash, payload.Password) {
		return nil, grpcerrors.ErrUserNotFound
	}

	// create tokens
	tokenResponse, err := getTokenResponse(user.ID, user.Role, config)
	if err != nil {
		return nil, grpcerrors.ErrInternal
	}
	return tokenResponse, nil
}

func (s *authService) RefreshToken(ctx context.Context, payload *authpb.RefreshTokenRequest, config *config.Config) (*authpb.TokenResponse, error) {
	// validate refresh token
	userID, role, err := auth.VerifyToken(payload.RefreshToken, config.JWTPublicKey)
	if err != nil {
		if errors.Is(err, grpcerrors.ErrUserUnauthenticated) {
			return nil, grpcerrors.ErrUserUnauthenticated
		}
		return nil, grpcerrors.ErrInternal
	}

	// check user is still in db
	exists, err := s.repo.IsUserExists(ctx, userID)
	if err != nil {
		return nil, grpcerrors.ErrInternal
	}
	if !exists {
		return nil, grpcerrors.ErrUserNotFound
	}

	// create new pair of tokens
	tokenResponse, err := getTokenResponse(userID, role, config)
	if err != nil {
		return nil, grpcerrors.ErrInternal
	}

	return tokenResponse, nil
}

// create token response using userID and role
func getTokenResponse(userID uuid.UUID, role string, config *config.Config) (*authpb.TokenResponse, error) {
	accessToken, err := auth.CreateSignedToken(userID, role, config.JWTAccessTokenExpireTime, config.JWTPrivateKey)
	if err != nil {
		log.Println("error when tried to create access token, ", err)
		return nil, err
	}
	refreshToken, err := auth.CreateSignedToken(userID, role, config.JWTRefreshTokenExpireTime, config.JWTPrivateKey)
	if err != nil {
		log.Println("error when tried to create access token, ", err)
		return nil, err
	}

	tokenResponse := authpb.TokenResponse{AccessToken: accessToken, RefreshToken: refreshToken}
	return &tokenResponse, nil
}
