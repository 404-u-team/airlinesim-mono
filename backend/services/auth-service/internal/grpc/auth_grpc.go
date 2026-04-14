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
		// if errors.Is(err, service.ErrUserWithSuchEmailExists) {
		// 	return nil, service.ErrUserWithSuchEmailExists
		// }
		// if errors.Is(err, service.ErrUserWithSuchNicknameExists) {
		// 	return nil, service.ErrUserWithSuchNicknameExists
		// }
		// return nil, service.ErrInternal
	}

	return tokenResponse, nil
}

func (s *authServer) Login(context context.Context, payload *authpb.LoginRequest) (*authpb.TokenResponse, error) {
	tokenResponse, err := s.authService.Login(context, payload, s.config)
	if err != nil {
		return nil, err
		// if errors.Is(err, service.ErrUserExists) {
		// 	return nil, service.ErrUserExists
		// }
		// if errors.Is(err, service.ErrInternal) {
		// 	return nil, service.ErrInternal
		// }
	}

	return tokenResponse, nil
}

func (s *authServer) ValidateToken(context context.Context, req *authpb.ValidateTokenRequest) (*authpb.ValidateTokenResponse, error) {
	return &authpb.ValidateTokenResponse{UserId: 18, Valid: true}, nil
}
