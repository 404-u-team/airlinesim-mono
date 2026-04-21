package grpcclient

import (
	"context"
	"log"

	worldpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/world/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type WorldClient struct {
	client worldpb.WorldServiceClient
	conn   *grpc.ClientConn
}

func NewWorldClient(addr string) (*WorldClient, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Println("got error when tried to create conn with auth client, ", err)
		return nil, err
	}

	return &WorldClient{
		client: worldpb.NewWorldServiceClient(conn),
		conn:   conn,
	}, nil
}

func (c *WorldClient) Close() {
	err := c.conn.Close()
	if err != nil {
		log.Fatalln("got erorr when tried to close world client conn, ", err)
	}
}

func (c *WorldClient) CreateCountry(ctx context.Context, req *worldpb.CreateCountryRequest) (*worldpb.IDResponse, error) {
	return c.client.CreateCountry(ctx, req)
}
