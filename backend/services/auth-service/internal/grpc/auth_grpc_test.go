package grpc

import (
	"context"
	"testing"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/config"
	grpcerrors "github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/errors"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
)

type mockAuthService struct {
	register     func(context.Context, *authpb.RegisterRequest, *config.Config) (*authpb.TokenResponse, error)
	login        func(context.Context, *authpb.LoginRequest, *config.Config) (*authpb.TokenResponse, error)
	refreshToken func(context.Context, *authpb.RefreshTokenRequest, *config.Config) (*authpb.TokenResponse, error)
	verifyToken  func(context.Context, *authpb.VerifyTokenRequest, *config.Config) (*authpb.VerifyTokenResponse, error)
}

func (m *mockAuthService) Register(ctx context.Context, payload *authpb.RegisterRequest, config *config.Config) (*authpb.TokenResponse, error) {
	return m.register(ctx, payload, config)
}

func (m *mockAuthService) Login(ctx context.Context, payload *authpb.LoginRequest, config *config.Config) (*authpb.TokenResponse, error) {
	return m.login(ctx, payload, config)
}

func (m *mockAuthService) RefreshToken(ctx context.Context, payload *authpb.RefreshTokenRequest, config *config.Config) (*authpb.TokenResponse, error) {
	return m.refreshToken(ctx, payload, config)
}

func (m *mockAuthService) VerifyToken(ctx context.Context, payload *authpb.VerifyTokenRequest, config *config.Config) (*authpb.VerifyTokenResponse, error) {
	return m.verifyToken(ctx, payload, config)
}

func TestRegister(t *testing.T) {
	t.Run("captured payload and expected response", func(t *testing.T) {
		tokenResponseExpected := authpb.TokenResponse{AccessToken: "1", RefreshToken: "2"}
		var capturedPayload *authpb.RegisterRequest

		service := &mockAuthService{
			register: func(ctx context.Context, payload *authpb.RegisterRequest, config *config.Config) (*authpb.TokenResponse, error) {
				capturedPayload = payload
				return &tokenResponseExpected, nil
			},
		}

		authServer := NewAuthServer(service)

		registerRequest := &authpb.RegisterRequest{
			Email:    "email",
			Nickname: "nickname",
			Password: "password",
		}
		tokenResponse, _ := authServer.Register(context.Background(), registerRequest)
		if registerRequest != capturedPayload {
			t.Fatalf("capture payload is not the same with passed one, got %v, want %v", capturedPayload, registerRequest)
		}

		if tokenResponse.AccessToken != tokenResponseExpected.AccessToken ||
			tokenResponse.RefreshToken != tokenResponseExpected.RefreshToken {
			t.Fatalf("returned token response is not what expected, want %v and %v, got %v and %v", tokenResponseExpected.AccessToken, tokenResponseExpected.RefreshToken, tokenResponse.AccessToken, tokenResponse.RefreshToken)
		}
	})

	t.Run("errors are passed as they are (email exists)", func(t *testing.T) {
		serviceEmailExists := &mockAuthService{
			register: func(ctx context.Context, payload *authpb.RegisterRequest, config *config.Config) (*authpb.TokenResponse, error) {
				return nil, grpcerrors.ErrUserWithSuchEmailExists
			},
		}

		authServer := NewAuthServer(serviceEmailExists)
		_, err := authServer.Register(context.Background(), nil)
		if err == nil {
			t.Fatal("expected to get an error, got nil")
		}
		if err != grpcerrors.ErrUserWithSuchEmailExists {
			t.Fatalf("want email exists error, got %v", err)
		}
	})

	t.Run("errors are passed as they are (nickname exists)", func(t *testing.T) {
		serviceEmailExists := &mockAuthService{
			register: func(ctx context.Context, payload *authpb.RegisterRequest, config *config.Config) (*authpb.TokenResponse, error) {
				return nil, grpcerrors.ErrUserWithSuchNicknameExists
			},
		}

		authServer := NewAuthServer(serviceEmailExists)
		_, err := authServer.Register(context.Background(), nil)
		if err == nil {
			t.Fatal("expected to get an error, got nil")
		}
		if err != grpcerrors.ErrUserWithSuchNicknameExists {
			t.Fatalf("want nickname exists error, got %v", err)
		}
	})
}

func TestLogin(t *testing.T) {
	t.Run("captured payload and expected response", func(t *testing.T) {
		tokenResponseExpected := &authpb.TokenResponse{AccessToken: "1", RefreshToken: "2"}
		var capturedPayload *authpb.LoginRequest

		service := &mockAuthService{
			login: func(ctx context.Context, payload *authpb.LoginRequest, config *config.Config) (*authpb.TokenResponse, error) {
				capturedPayload = payload
				return tokenResponseExpected, nil
			},
		}

		authServer := NewAuthServer(service)

		loginRequest := &authpb.LoginRequest{
			Login:    "login",
			Password: "password",
		}
		tokenResponse, _ := authServer.Login(context.Background(), loginRequest)
		if loginRequest != capturedPayload {
			t.Fatalf("capture payload is not the same with passed one, got %v, want %v", capturedPayload, loginRequest)
		}

		if tokenResponse.AccessToken != tokenResponseExpected.AccessToken ||
			tokenResponse.RefreshToken != tokenResponseExpected.RefreshToken {
			t.Fatalf("returned token response is not what expected, want %v and %v, got %v and %v", tokenResponseExpected.AccessToken, tokenResponseExpected.RefreshToken, tokenResponse.AccessToken, tokenResponse.RefreshToken)
		}
	})

	t.Run("errors are passed as they are (email exists)", func(t *testing.T) {
		serviceEmailExists := &mockAuthService{
			login: func(ctx context.Context, payload *authpb.LoginRequest, config *config.Config) (*authpb.TokenResponse, error) {
				return nil, grpcerrors.ErrUserWithSuchEmailExists
			},
		}

		authServer := NewAuthServer(serviceEmailExists)
		_, err := authServer.Login(context.Background(), nil)
		if err == nil {
			t.Fatal("expected to get an error, got nil")
		}
		if err != grpcerrors.ErrUserWithSuchEmailExists {
			t.Fatalf("want email exists error, got %v", err)
		}
	})

	t.Run("errors are passed as they are (nickname exists)", func(t *testing.T) {
		serviceEmailExists := &mockAuthService{
			login: func(ctx context.Context, payload *authpb.LoginRequest, config *config.Config) (*authpb.TokenResponse, error) {
				return nil, grpcerrors.ErrUserWithSuchNicknameExists
			},
		}

		authServer := NewAuthServer(serviceEmailExists)
		_, err := authServer.Login(context.Background(), nil)
		if err == nil {
			t.Fatal("expected to get an error, got nil")
		}
		if err != grpcerrors.ErrUserWithSuchNicknameExists {
			t.Fatalf("want nickname exists error, got %v", err)
		}
	})
}

func TestRefresh(t *testing.T) {
	t.Run("captured payload and expected response", func(t *testing.T) {
		tokenResponseExpected := &authpb.TokenResponse{AccessToken: "1", RefreshToken: "2"}
		var capturedPayload *authpb.RefreshTokenRequest

		service := &mockAuthService{
			refreshToken: func(ctx context.Context, payload *authpb.RefreshTokenRequest, config *config.Config) (*authpb.TokenResponse, error) {
				capturedPayload = payload
				return tokenResponseExpected, nil
			},
		}

		authServer := NewAuthServer(service)

		refreshRequest := &authpb.RefreshTokenRequest{
			RefreshToken: "3",
		}
		tokenResponse, _ := authServer.RefreshToken(context.Background(), refreshRequest)
		if refreshRequest != capturedPayload {
			t.Fatalf("capture payload is not the same with passed one, got %v, want %v", capturedPayload, refreshRequest)
		}

		if tokenResponse.AccessToken != tokenResponseExpected.AccessToken ||
			tokenResponse.RefreshToken != tokenResponseExpected.RefreshToken {
			t.Fatalf("returned token response is not what expected, want %v and %v, got %v and %v", tokenResponseExpected.AccessToken, tokenResponseExpected.RefreshToken, tokenResponse.AccessToken, tokenResponse.RefreshToken)
		}
	})

	t.Run("errors are passed as they are (email exists)", func(t *testing.T) {
		serviceEmailExists := &mockAuthService{
			login: func(ctx context.Context, payload *authpb.LoginRequest, config *config.Config) (*authpb.TokenResponse, error) {
				return nil, grpcerrors.ErrUserWithSuchEmailExists
			},
		}

		authServer := NewAuthServer(serviceEmailExists)
		_, err := authServer.Login(context.Background(), nil)
		if err == nil {
			t.Fatal("expected to get an error, got nil")
		}
		if err != grpcerrors.ErrUserWithSuchEmailExists {
			t.Fatalf("want email exists error, got %v", err)
		}
	})

	t.Run("errors are passed as they are (nickname exists)", func(t *testing.T) {
		serviceEmailExists := &mockAuthService{
			login: func(ctx context.Context, payload *authpb.LoginRequest, config *config.Config) (*authpb.TokenResponse, error) {
				return nil, grpcerrors.ErrUserWithSuchNicknameExists
			},
		}

		authServer := NewAuthServer(serviceEmailExists)
		_, err := authServer.Login(context.Background(), nil)
		if err == nil {
			t.Fatal("expected to get an error, got nil")
		}
		if err != grpcerrors.ErrUserWithSuchNicknameExists {
			t.Fatalf("want nickname exists error, got %v", err)
		}
	})
}
