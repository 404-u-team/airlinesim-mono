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
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Println("got error when tried to create conn with airline client, ", err)
		return nil, err
	}

	return &AirlineClient{client: airlinepb.NewAirlineServiceClient(conn), conn: conn}, nil
}

func (c *AirlineClient) Close() {
	if err := c.conn.Close(); err != nil {
		log.Fatalln("got erorr when tried to close airline client conn, ", err)
	}
}

func (c *AirlineClient) CreateAirline(ctx context.Context, req *airlinepb.CreateAirlineRequest) (*airlinepb.CreateAirlineResponse, error) {
	return c.client.CreateAirline(ctx, req)
}

func (c *AirlineClient) GetAirlineByID(ctx context.Context, req *airlinepb.GetAirlineByIDRequest) (*airlinepb.AirlineResponse, error) {
	return c.client.GetAirlineByID(ctx, req)
}

func (c *AirlineClient) GetAirlineByOwnerID(ctx context.Context, req *airlinepb.GetAirlineByOwnerIDRequest) (*airlinepb.AirlineResponse, error) {
	return c.client.GetAirlineByOwnerID(ctx, req)
}

func (c *AirlineClient) UpdateAirline(ctx context.Context, req *airlinepb.UpdateAirlineRequest) (*airlinepb.AirlineResponse, error) {
	return c.client.UpdateAirline(ctx, req)
}
