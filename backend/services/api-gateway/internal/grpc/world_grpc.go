package grpcclient

import (
	"log"

	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"google.golang.org/grpc"
)

type WorldClient struct {
	client authpb.AuthServiceClient
	conn   *grpc.ClientConn
}

func NewWorldClient(addr string) (*WorldClient, error) {
	// conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	// if err != nil {
	// 	log.Fatalln("got error when tried to create conn with auth client, ", err)
	// 	return nil, err
	// }

	return nil, nil
	// return &WorldClient{
	// 	client: authpb.NewAuthServiceClient(conn),
	// 	conn:   conn,
	// }, nil
}

func (c *WorldClient) Close() {
	err := c.conn.Close()
	if err != nil {
		log.Fatalln("got erorr when tried to close auth client conn, ", err)
	}
}

// func (c *WorldClient) Register(ctx context.Context, req *authpb.RegisterRequest) (*authpb.TokenResponse, error) {
// 	return c.client.Register(ctx, req)
// }
