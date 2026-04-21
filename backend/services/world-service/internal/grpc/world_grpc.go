package grpc

import (
	"context"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/service"
	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
)

type worldServer struct {
	worldpb.UnimplementedWorldServiceServer
	worldService service.WorldService
	config       *config.Config
}

func NewWorldServer(worldService service.WorldService) *worldServer {
	config := config.InitConfig()
	return &worldServer{worldService: worldService, config: &config}
}

func (s *worldServer) CreateCountry(ctx context.Context, payload *worldpb.CreateCountryRequest) (*worldpb.IDResponse, error) {
	IDResponse, err := s.worldService.CreateCountry(ctx, payload)
	if err != nil {
		return nil, err
	}

	return IDResponse, nil
}
