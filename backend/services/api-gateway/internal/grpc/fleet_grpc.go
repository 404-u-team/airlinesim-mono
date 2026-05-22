package grpcclient

import (
	"context"
	"log"

	fleetpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/fleet/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/emptypb"
)

type FleetClient struct {
	client fleetpb.FleetServiceClient
	conn   *grpc.ClientConn
}

func NewFleetClient(addr string) (*FleetClient, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Println("got error when tried to create conn with fleet client, ", err)
		return nil, err
	}

	return &FleetClient{
		client: fleetpb.NewFleetServiceClient(conn),
		conn:   conn,
	}, nil
}

func (c *FleetClient) Close() {
	if err := c.conn.Close(); err != nil {
		log.Fatalln("got erorr when tried to close fleet client conn, ", err)
	}
}

func (c *FleetClient) CreateAircraft(ctx context.Context, req *fleetpb.CreateAircraftRequest) (*fleetpb.CreateAircraftResponse, error) {
	return c.client.CreateAircraft(ctx, req)
}

func (c *FleetClient) ListAircraftTypes(ctx context.Context) (*fleetpb.ListAircraftTypesResponse, error) {
	return c.client.ListAircraftTypes(ctx, &emptypb.Empty{})
}

func (c *FleetClient) GetAircraftType(ctx context.Context, id string) (*fleetpb.AircraftType, error) {
	return c.client.GetAircraftType(ctx, &fleetpb.GetAircraftTypeRequest{Id: id})
}

func (c *FleetClient) CreateAircraftType(ctx context.Context, req *fleetpb.CreateAircraftTypeRequest) (*fleetpb.AircraftType, error) {
	return c.client.CreateAircraftType(ctx, req)
}
