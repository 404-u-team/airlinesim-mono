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

func (c *WorldClient) ChangeCountry(ctx context.Context, req *worldpb.ChangeCountryRequest) (*worldpb.IDResponse, error) {
	return c.client.ChangeCountry(ctx, req)
}

func (c *WorldClient) ListCountries(ctx context.Context) (*worldpb.ListCountriesResponse, error) {
	return c.client.ListCountries(ctx, &worldpb.ListCountriesRequest{})
}

func (c *WorldClient) DeleteCountry(ctx context.Context, req *worldpb.DeleteCountryRequest) (*worldpb.IDResponse, error) {
	return c.client.DeleteCountry(ctx, req)
}

func (c *WorldClient) CreateRegion(ctx context.Context, req *worldpb.CreateRegionRequest) (*worldpb.IDResponse, error) {
	return c.client.CreateRegion(ctx, req)
}

func (c *WorldClient) ChangeRegion(ctx context.Context, req *worldpb.ChangeRegionRequest) (*worldpb.IDResponse, error) {
	return c.client.ChangeRegion(ctx, req)
}

func (c *WorldClient) ListRegions(ctx context.Context) (*worldpb.ListRegionsResponse, error) {
	return c.client.ListRegions(ctx, &worldpb.ListRegionsRequest{})
}

func (c *WorldClient) DeleteRegion(ctx context.Context, req *worldpb.DeleteRegionRequest) (*worldpb.IDResponse, error) {
	return c.client.DeleteRegion(ctx, req)
}

func (c *WorldClient) CreateRegionLink(ctx context.Context, req *worldpb.CreateRegionLinkRequest) (*worldpb.IDResponse, error) {
	return c.client.CreateRegionLink(ctx, req)
}

func (c *WorldClient) ChangeRegionLink(ctx context.Context, req *worldpb.ChangeRegionLinkRequest) (*worldpb.IDResponse, error) {
	return c.client.ChangeRegionLink(ctx, req)
}

func (c *WorldClient) ListRegionLinks(ctx context.Context) (*worldpb.ListRegionLinksResponse, error) {
	return c.client.ListRegionLinks(ctx, &worldpb.ListRegionLinksRequest{})
}

func (c *WorldClient) DeleteRegionLink(ctx context.Context, req *worldpb.DeleteRegionLinkRequest) (*worldpb.IDResponse, error) {
	return c.client.DeleteRegionLink(ctx, req)
}

func (c *WorldClient) CreateAirport(ctx context.Context, req *worldpb.CreateAirportRequest) (*worldpb.IDResponse, error) {
	return c.client.CreateAirport(ctx, req)
}

func (c *WorldClient) ChangeAirport(ctx context.Context, req *worldpb.ChangeAirportRequest) (*worldpb.IDResponse, error) {
	return c.client.ChangeAirport(ctx, req)
}

func (c *WorldClient) ListAirports(ctx context.Context) (*worldpb.ListAirportsResponse, error) {
	return c.client.ListAirports(ctx, &worldpb.ListAirportsRequest{})
}

func (c *WorldClient) DeleteAirport(ctx context.Context, req *worldpb.DeleteAirportRequest) (*worldpb.IDResponse, error) {
	return c.client.DeleteAirport(ctx, req)
}
