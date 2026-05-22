package grpcclient

import (
	"context"
	"log"

	airlinepb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/airline/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type AirlineClient struct {
	client airlinepb.AirlineServiceClient
	conn   *grpc.ClientConn
}

func NewAirlineClient(addr string) (*AirlineClient, error) {
	conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Println("got error when tried to create conn with airline client, ", err)
		return nil, err
	}

	return &AirlineClient{client: airlinepb.NewAirlineServiceClient(conn), conn: conn}, nil
}

func (c *AirlineClient) Close() {
	if err := c.conn.Close(); err != nil {
		log.Fatalln("got error when tried to close airline client conn, ", err)
	}
}

func (c *AirlineClient) AdjustBalance(ctx context.Context, req *airlinepb.AdjustBalanceRequest) (*airlinepb.AdjustBalanceResponse, error) {
	return c.client.AdjustBalance(ctx, req)
}
