package grpcclient

import (
	"context"
	"log"

	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type AuthClient struct {
	client authpb.AuthServiceClient
	conn   *grpc.ClientConn
}

func NewAuthClient(addr string) (*AuthClient, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalln("got error when tried to create conn with auth client, ", err)
		return nil, err
	}

	return &AuthClient{
		client: authpb.NewAuthServiceClient(conn),
		conn:   conn,
	}, nil
}

func (c *AuthClient) Close() {
	err := c.conn.Close()
	if err != nil {
		log.Fatalln("got erorr when tried to close auth client conn, ", err)
	}
}

func (c *AuthClient) Register(ctx context.Context, req *authpb.RegisterRequest) (*authpb.TokenResponse, error) {
	return c.client.Register(ctx, req)
}

func (c *AuthClient) Login(ctx context.Context, req *authpb.LoginRequest) (*authpb.TokenResponse, error) {
	return c.client.Login(ctx, req)
}
