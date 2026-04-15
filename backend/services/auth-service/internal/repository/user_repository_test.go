package repository

import (
	"context"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	testcontainers "github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/wait"
)

var pool *pgxpool.Pool

func TestMain(m *testing.M) {
	// setuping testcontainers - posgtes 18.3
	ctx := context.Background()

	req := testcontainers.ContainerRequest{
		Image:        "postgres:18.3-alpine",
		ExposedPorts: []string{"5432/tcp"},
		Env: map[string]string{
			"POSTGRES_USER":     "postgres",
			"POSTGRES_PASSWORD": "password",
			"POSTGRES_DB":       "db",
		},
		WaitingFor: wait.ForListeningPort("5432/tcp").
			WithStartupTimeout(60 * time.Second),
	}

	container, err := testcontainers.GenericContainer(ctx, testcontainers.GenericContainerRequest{
		ContainerRequest: req,
		Started:          true,
	})
	if err != nil {
		log.Fatalf("start postgres container: %v", err)
	}

	host, err := container.Host(ctx)
	if err != nil {
		log.Fatalf("get host: %v", err)
	}

	port, err := container.MappedPort(ctx, "5432")
	if err != nil {
		log.Fatalf("get mapped port: %v", err)
	}

	connString := fmt.Sprintf(
		"postgres://postgres:password@%s:%s/db?sslmode=disable",
		host,
		port.Port(),
	)

	pool, err = pgxpool.New(ctx, connString)
	if err != nil {
		log.Fatalf("create pool: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	// running tests
	code := m.Run()

	// clean up
	pool.Close()
	if err := container.Terminate(ctx); err != nil {
		log.Fatalf("Failed to terminate container: %s", err)
	}
	os.Exit(code)
}

func TestUserCreate(t *testing.T) {

}
