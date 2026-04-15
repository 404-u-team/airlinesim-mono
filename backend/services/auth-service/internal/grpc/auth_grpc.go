package grpc

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/service"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
)

type authServer struct {
	authpb.UnimplementedAuthServiceServer
	authService service.AuthService
	config      *config.Config
}

func NewAuthServer(authService service.AuthService) *authServer {
	config := config.InitConfig()
	return &authServer{authService: authService, config: &config}
}

func (s *authServer) Register(ctx context.Context, payload *authpb.RegisterRequest) (*authpb.TokenResponse, error) {
	tokenResponse, err := s.authService.Register(ctx, payload, s.config)
	if err != nil {
		return nil, err
	}

	return tokenResponse, nil
}

func (s *authServer) Login(context context.Context, payload *authpb.LoginRequest) (*authpb.TokenResponse, error) {
	tokenResponse, err := s.authService.Login(context, payload, s.config)
	if err != nil {
		return nil, err
	}

	return tokenResponse, nil
}

// func (s *authServer) RefreshToken(context context.Context, payload *authpb.RefreshTokenRequest) (*authpb.TokenResponse, error) {
// 	tokenResponse, err := s.authService.Refresh(context, payload, s.config)
// 	if err != nil {
// 		return nil, err
// 	}

// 	return tokenResponse, nil
// }
