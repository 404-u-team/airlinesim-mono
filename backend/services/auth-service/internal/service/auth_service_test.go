package service

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"errors"
	"testing"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/auth"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/dto"
	grpcerrors "github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/errors"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type mockUserRepository struct {
	createUser     func(context.Context, *authpb.RegisterRequest) (uuid.UUID, error)
	getUserByEmail func(context.Context, string) (*dto.User, error)
	getUserByNick  func(context.Context, string) (*dto.User, error)
	isUserExists   func(context.Context, uuid.UUID) (bool, error)
}

func (m *mockUserRepository) CreateUser(ctx context.Context, payload *authpb.RegisterRequest) (uuid.UUID, error) {
	return m.createUser(ctx, payload)
}

func (m *mockUserRepository) GetUserByEmail(ctx context.Context, email string) (*dto.User, error) {
	return m.getUserByEmail(ctx, email)
}

func (m *mockUserRepository) GetUserByNickname(ctx context.Context, nickname string) (*dto.User, error) {
	return m.getUserByNick(ctx, nickname)
}

func (m *mockUserRepository) IsUserExists(ctx context.Context, userID uuid.UUID) (bool, error) {
	return m.isUserExists(ctx, userID)
}

func testConfig(t *testing.T) *config.Config {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}

	return &config.Config{
		JWTPrivateKey:             privateKey,
		JWTPublicKey:              &privateKey.PublicKey,
		JWTAccessTokenExpireTime:  60,
		JWTRefreshTokenExpireTime: 120,
	}
}

func TestAuthService_Register_Success(t *testing.T) {
	config := testConfig(t)
	userID := uuid.New()

	var capturedPayload *authpb.RegisterRequest
	repo := &mockUserRepository{
		createUser: func(ctx context.Context, payload *authpb.RegisterRequest) (uuid.UUID, error) {
			capturedPayload = payload
			return userID, nil
		},
	}

	authService := NewAuthService(repo)
	request := &authpb.RegisterRequest{
		Email:    "user@example.com",
		Nickname: "neo",
		Password: "secret",
	}

	response, err := authService.Register(context.Background(), request, config)
	if err != nil {
		t.Fatalf("register returned error: %v", err)
	}
	if response == nil {
		t.Fatal("expected token response, got nil")
	}
	if capturedPayload == nil {
		t.Fatal("expected repository to receive payload")
	}
	if capturedPayload.Password == "secret" {
		t.Fatal("expected password to be hashed before repository call")
	}
	if !auth.ComparePasswords(capturedPayload.Password, "secret") {
		t.Fatal("expected hashed password to match original password")
	}

	// check userID and role from access token
	tokenUserID, tokenRole, err := auth.VerifyToken(response.AccessToken, config.JWTPublicKey)
	if err != nil {
		t.Fatalf("got error when tried to verify access token: %v", err)
	}

	if tokenUserID != userID {
		t.Fatalf("unexpected access token value, want %v, got %v", userID, tokenUserID)
	}
	if tokenRole != "user" {
		t.Fatalf("unexpected access token value, want %v, got \"user\"", tokenRole)
	}

	// check userID and role from refresh token
	tokenUserID, tokenRole, err = auth.VerifyToken(response.RefreshToken, config.JWTPublicKey)
	if err != nil {
		t.Fatalf("got error when tried to verify refresh token: %v", err)
	}

	if tokenUserID != userID {
		t.Fatalf("unexpected refresh token value, want %v, got %v", userID, tokenUserID)
	}
	if tokenRole != "user" {
		t.Fatalf("unexpected refresh token value, want \"user\", got %v", tokenRole)
	}

}

func TestAuthService_Register_UniqueConstraintErrors(t *testing.T) {
	config := testConfig(t)
	repo := &mockUserRepository{
		createUser: func(ctx context.Context, payload *authpb.RegisterRequest) (uuid.UUID, error) {
			return uuid.Nil, &pgconn.PgError{Code: "23505", ConstraintName: "users_email_key"}
		},
	}

	authService := NewAuthService(repo)
	_, err := authService.Register(context.Background(), &authpb.RegisterRequest{
		Email:    "user@example.com",
		Nickname: "neo",
		Password: "secret",
	}, config)
	if !errors.Is(err, grpcerrors.ErrUserWithSuchEmailExists) {
		t.Fatalf("expected email conflict error, got %v", err)
	}

	repo = &mockUserRepository{
		createUser: func(ctx context.Context, payload *authpb.RegisterRequest) (uuid.UUID, error) {
			return uuid.Nil, &pgconn.PgError{Code: "23505", ConstraintName: "users_nickname_key"}
		},
	}
	authService = NewAuthService(repo)
	_, err = authService.Register(context.Background(), &authpb.RegisterRequest{
		Email:    "user@example.com",
		Nickname: "neo",
		Password: "secret",
	}, config)
	if !errors.Is(err, grpcerrors.ErrUserWithSuchNicknameExists) {
		t.Fatalf("expected nickname conflict error, got %v", err)
	}
}

func TestAuthService_Register_RepositoryError(t *testing.T) {
	config := testConfig(t)
	repo := &mockUserRepository{
		createUser: func(ctx context.Context, payload *authpb.RegisterRequest) (uuid.UUID, error) {
			return uuid.Nil, errors.New("db down")
		},
	}

	authService := NewAuthService(repo)
	_, err := authService.Register(context.Background(), &authpb.RegisterRequest{
		Email:    "user@example.com",
		Nickname: "neo",
		Password: "secret",
	}, config)
	if !errors.Is(err, grpcerrors.ErrInternal) {
		t.Fatalf("expected internal error, got %v", err)
	}
}

func TestAuthService_Login_ByEmailSuccess(t *testing.T) {
	config := testConfig(t)
	hashedPassword, err := auth.HashPassword("secret")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	userID := uuid.New()
	repo := &mockUserRepository{
		getUserByEmail: func(ctx context.Context, email string) (*dto.User, error) {
			return &dto.User{ID: userID, PasswordHash: hashedPassword, Role: "admin"}, nil
		},
	}

	authService := NewAuthService(repo)
	response, err := authService.Login(context.Background(), &authpb.LoginRequest{
		Login:    "user@example.com",
		Password: "secret",
	}, config)
	if err != nil {
		t.Fatalf("login returned error: %v", err)
	}
	if response == nil {
		t.Fatal("expected token response, got nil")
	}

	tokenUserID, tokenRole, err := auth.VerifyToken(response.AccessToken, config.JWTPublicKey)
	if err != nil {
		t.Fatalf("got error when tried to verify access token: %v", err)
	}
	if tokenRole != "admin" {
		t.Fatalf("unexpected userID, want %v, got %v", userID, tokenUserID)
	}
	if tokenRole != "admin" {
		t.Fatalf("unexpected token role, want \"admin\", got %v", tokenRole)
	}
}

func TestAuthService_Login_UserNotFoundAndRepositoryError(t *testing.T) {
	config := testConfig(t)

	repo := &mockUserRepository{
		getUserByNick: func(ctx context.Context, nickname string) (*dto.User, error) {
			return nil, pgx.ErrNoRows
		},
	}
	authService := NewAuthService(repo)
	_, err := authService.Login(context.Background(), &authpb.LoginRequest{
		Login:    "neo",
		Password: "secret",
	}, config)
	if !errors.Is(err, grpcerrors.ErrUserNotFound) {
		t.Fatalf("expected not found error, got %v", err)
	}

	repo = &mockUserRepository{
		getUserByEmail: func(ctx context.Context, email string) (*dto.User, error) {
			return nil, errors.New("db down")
		},
	}
	authService = NewAuthService(repo)
	_, err = authService.Login(context.Background(), &authpb.LoginRequest{
		Login:    "user@example.com",
		Password: "secret",
	}, config)
	if !errors.Is(err, grpcerrors.ErrInternal) {
		t.Fatalf("expected internal error, got %v", err)
	}
}

func TestAuthService_Login_WrongPassword(t *testing.T) {
	config := testConfig(t)
	hashedPassword, err := auth.HashPassword("secret")
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	repo := &mockUserRepository{
		getUserByEmail: func(ctx context.Context, email string) (*dto.User, error) {
			return &dto.User{ID: uuid.New(), PasswordHash: hashedPassword, Role: "user"}, nil
		},
	}

	authService := NewAuthService(repo)
	_, err = authService.Login(context.Background(), &authpb.LoginRequest{
		Login:    "user@example.com",
		Password: "wrong-password",
	}, config)
	if !errors.Is(err, grpcerrors.ErrUserNotFound) {
		t.Fatalf("expected wrong password to look like not found, got %v", err)
	}
}

func TestAuthService_Refresh_Success(t *testing.T) {
	config := testConfig(t)

	userID := uuid.New()
	refreshToken, err := auth.CreateSignedToken(userID, "user", config.JWTRefreshTokenExpireTime, config.JWTPrivateKey)
	if err != nil {
		t.Fatalf("got error when tried to create refresh token, %v", err)
	}
	refreshTokenRequest := &authpb.RefreshTokenRequest{RefreshToken: refreshToken}

	repo := &mockUserRepository{
		isUserExists: func(context.Context, uuid.UUID) (bool, error) {
			return true, nil
		},
	}

	authService := NewAuthService(repo)
	tokenResponse, err := authService.RefreshToken(context.Background(), refreshTokenRequest, config)
	if err != nil {
		t.Fatalf("got error when tried to refresh token, %v", err)
	}

	if tokenResponse == nil {
		t.Fatalf("token response is nil")
	}

	// check userID and role from access token
	tokenUserID, tokenRole, err := auth.VerifyToken(tokenResponse.AccessToken, config.JWTPublicKey)
	if err != nil {
		t.Fatalf("got error when tried to verify access token: %v", err)
	}

	if tokenUserID != userID {
		t.Fatalf("unexpected access token value, want %v, got %v", userID, tokenUserID)
	}
	if tokenRole != "user" {
		t.Fatalf("unexpected access token value, want %v, got \"user\"", tokenRole)
	}

	// check userID and role from refresh token
	tokenUserID, tokenRole, err = auth.VerifyToken(tokenResponse.RefreshToken, config.JWTPublicKey)
	if err != nil {
		t.Fatalf("got error when tried to verify refresh token: %v", err)
	}

	if tokenUserID != userID {
		t.Fatalf("unexpected refresh token value, want %v, got %v", userID, tokenUserID)
	}
	if tokenRole != "user" {
		t.Fatalf("unexpected refresh token value, want \"user\", got %v", tokenRole)
	}
}

func TestAuthService_Refresh_Bad_Token(t *testing.T) {
	config := testConfig(t)

	userID := uuid.New()

	t.Run("expired token passed", func(t *testing.T) {
		repo := &mockUserRepository{
			isUserExists: func(context.Context, uuid.UUID) (bool, error) {
				return false, nil
			},
		}

		authService := NewAuthService(repo)

		tokenExpired, err := auth.CreateSignedToken(userID, "user", 0, config.JWTPrivateKey)
		if err != nil {
			t.Fatalf("got error when tried to create token, %v", err)
		}
		refreshTokenRequest := &authpb.RefreshTokenRequest{RefreshToken: tokenExpired}
		_, err = authService.RefreshToken(context.Background(), refreshTokenRequest, config)
		if !errors.Is(err, grpcerrors.ErrUserUnauthenticated) {
			t.Fatalf("expired token should return ErrUserUnauthenticated")
		}
	})

	t.Run("cant find user with such userID", func(t *testing.T) {
		repo := &mockUserRepository{
			isUserExists: func(context.Context, uuid.UUID) (bool, error) {
				return false, nil
			},
		}

		authService := NewAuthService(repo)

		token, err := auth.CreateSignedToken(userID, "user", config.JWTRefreshTokenExpireTime, config.JWTPrivateKey)
		if err != nil {
			t.Fatalf("got error when tried to create token, %v", err)
		}
		refreshTokenRequest := &authpb.RefreshTokenRequest{RefreshToken: token}

		_, err = authService.RefreshToken(context.Background(), refreshTokenRequest, config)
		if !errors.Is(err, grpcerrors.ErrUserUnauthenticated) {
			t.Fatalf("when user is not in db, the error should be ErrUserUnauthenticated, got %v", err)
		}

	})
}

func TestAuthService_Refresh_RepositoryError(t *testing.T) {
	config := testConfig(t)

	userID := uuid.New()

	refreshToken, err := auth.CreateSignedToken(userID, "user", config.JWTRefreshTokenExpireTime, config.JWTPrivateKey)
	if err != nil {
		t.Fatalf("got error when tried to create refresh token, %v", err)
	}
	refreshTokenRequest := &authpb.RefreshTokenRequest{RefreshToken: refreshToken}

	repo := &mockUserRepository{
		isUserExists: func(context.Context, uuid.UUID) (bool, error) {
			return false, pgx.ErrNoRows
		},
	}

	authService := NewAuthService(repo)

	_, err = authService.RefreshToken(context.Background(), refreshTokenRequest, config)
	if !errors.Is(err, grpcerrors.ErrInternal) {
		t.Fatalf("error in repository should return ErrInternal")
	}
}
