package grpcclient

import (
	"context"
	"log"

	operationspb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/operations/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type OperationsClient struct {
	client operationspb.OperationsServiceClient
	conn   *grpc.ClientConn
}

func NewOperationsClient(addr string) (*OperationsClient, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Println("got error when tried to create conn with auth client, ", err)
		return nil, err
	}

	return &OperationsClient{
		client: operationspb.NewOperationsServiceClient(conn),
		conn:   conn,
	}, nil
}

func (c *OperationsClient) Close() {
	err := c.conn.Close()
	if err != nil {
		log.Fatalln("got erorr when tried to close world client conn, ", err)
	}
}

func (c *OperationsClient) CreateCountry(ctx context.Context, req *operationspb.CreateCountryRequest) (*operationspb.IDResponse, error) {
	return c.client.CreateCountry(ctx, req)
}

func (c *OperationsClient) ChangeCountry(ctx context.Context, req *operationspb.ChangeCountryRequest) (*operationspb.IDResponse, error) {
	return c.client.ChangeCountry(ctx, req)
}

func (c *OperationsClient) ListCountries(ctx context.Context) (*operationspb.ListCountriesResponse, error) {
	return c.client.ListCountries(ctx, &operationspb.ListCountriesRequest{})
}

func (c *OperationsClient) DeleteCountry(ctx context.Context, req *operationspb.DeleteCountryRequest) (*operationspb.IDResponse, error) {
	return c.client.DeleteCountry(ctx, req)
}

func (c *OperationsClient) CreateRegion(ctx context.Context, req *operationspb.CreateRegionRequest) (*operationspb.IDResponse, error) {
	return c.client.CreateRegion(ctx, req)
}

func (c *OperationsClient) ChangeRegion(ctx context.Context, req *operationspb.ChangeRegionRequest) (*operationspb.IDResponse, error) {
	return c.client.ChangeRegion(ctx, req)
}

func (c *OperationsClient) ListRegions(ctx context.Context) (*operationspb.ListRegionsResponse, error) {
	return c.client.ListRegions(ctx, &operationspb.ListRegionsRequest{})
}

func (c *OperationsClient) DeleteRegion(ctx context.Context, req *operationspb.DeleteRegionRequest) (*operationspb.IDResponse, error) {
	return c.client.DeleteRegion(ctx, req)
}

func (c *OperationsClient) CreateRegionLink(ctx context.Context, req *operationspb.CreateRegionLinkRequest) (*operationspb.IDResponse, error) {
	return c.client.CreateRegionLink(ctx, req)
}

func (c *OperationsClient) ChangeRegionLink(ctx context.Context, req *operationspb.ChangeRegionLinkRequest) (*operationspb.IDResponse, error) {
	return c.client.ChangeRegionLink(ctx, req)
}

func (c *OperationsClient) ListRegionLinks(ctx context.Context) (*operationspb.ListRegionLinksResponse, error) {
	return c.client.ListRegionLinks(ctx, &operationspb.ListRegionLinksRequest{})
}

func (c *OperationsClient) DeleteRegionLink(ctx context.Context, req *operationspb.DeleteRegionLinkRequest) (*operationspb.IDResponse, error) {
	return c.client.DeleteRegionLink(ctx, req)
}

func (c *OperationsClient) CreateAirport(ctx context.Context, req *operationspb.CreateAirportRequest) (*operationspb.IDResponse, error) {
	return c.client.CreateAirport(ctx, req)
}

func (c *OperationsClient) ChangeAirport(ctx context.Context, req *operationspb.ChangeAirportRequest) (*operationspb.IDResponse, error) {
	return c.client.ChangeAirport(ctx, req)
}

func (c *OperationsClient) ListAirports(ctx context.Context) (*operationspb.ListAirportsResponse, error) {
	return c.client.ListAirports(ctx, &operationspb.ListAirportsRequest{})
}

func (c *OperationsClient) DeleteAirport(ctx context.Context, req *operationspb.DeleteAirportRequest) (*operationspb.IDResponse, error) {
	return c.client.DeleteAirport(ctx, req)
}
