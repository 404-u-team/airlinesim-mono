package repository

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"testing"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/auth-service/internal/db"
	authpb "github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth/v1"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
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

	pool = db.NewPostgresPool(connString)
	db.MigrateDatabase(connString)

	// running tests
	code := m.Run()

	// clean up
	pool.Close()
	if err := container.Terminate(ctx); err != nil {
		log.Fatalf("Failed to terminate container: %s", err)
	}
	os.Exit(code)
}

func setupTxRepo(t *testing.T) (UserRepository, func()) {
	t.Helper()

	tx, err := pool.BeginTx(context.Background(), pgx.TxOptions{})
	if err != nil {
		t.Fatalf("got error when tried to begin transaction, %v", err)
	}
	rollback := func() {
		_ = tx.Rollback(context.Background())
	}

	repo := NewUserRepository(tx)
	return repo, rollback
}

func TestUserCreate(t *testing.T) {
	pgErrEmailConstraint := &pgconn.PgError{Code: "23505", ConstraintName: "users_email_key"}
	pgErrNicknameConstraint := &pgconn.PgError{Code: "23505", ConstraintName: "users_nickname_key"}

	t.Run("valid user creation", func(t *testing.T) {
		// create first user
		repo, rollback := setupTxRepo(t)
		defer rollback()

		registerRequest := &authpb.RegisterRequest{
			Email: "email", Nickname: "nickname", Password: "password",
		}

		userID, err := repo.CreateUser(context.Background(), registerRequest)
		if err != nil {
			t.Fatalf("valid user creation should not return error, got %v", err)
		}
		if userID == uuid.Nil {
			t.Fatal("valid user creation should not return nil userID")
		}

		// create second user
		anotherRegisterRequest := &authpb.RegisterRequest{
			Email: "email2", Nickname: "nickname2", Password: "password",
		}

		userID, err = repo.CreateUser(context.Background(), anotherRegisterRequest)
		if err != nil {
			t.Fatalf("valid user creation of second user should not return error, got %v", err)
		}
		if userID == uuid.Nil {
			t.Fatal("valid user creation of second user should not return nil userID")
		}
	})

	t.Run("same user creation", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		registerRequest := &authpb.RegisterRequest{
			Email: "email", Nickname: "nickname", Password: "password",
		}
		_, _ = repo.CreateUser(context.Background(), registerRequest)

		_, err := repo.CreateUser(context.Background(), registerRequest)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) {
			t.Fatalf("same user creation should return pg error, got %v", err)
		}
		if pgErr.Code != pgErrEmailConstraint.Code && pgErr.Code != pgErrNicknameConstraint.Code {
			t.Fatalf("same user creation should return unique violation, got code %s", pgErr.Code)
		}
		if pgErr.ConstraintName != pgErrEmailConstraint.ConstraintName && pgErr.ConstraintName != pgErrNicknameConstraint.ConstraintName {
			t.Fatalf("same user creation should return unique constraint validation, got constraint %s", pgErr.ConstraintName)
		}
	})

	t.Run("not unique email", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		registerRequest := &authpb.RegisterRequest{
			Email: "email", Nickname: "nickname", Password: "password",
		}
		_, err := repo.CreateUser(context.Background(), registerRequest)
		if err != nil {
			t.Fatalf("got error when tried to create user, %v", err)
		}

		// create user with same email
		registerRequest.Nickname = "nickname2"

		_, err = repo.CreateUser(context.Background(), registerRequest)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) {
			t.Fatalf("want pgError, got %v", err)
		}
		if pgErr.Code != pgErrEmailConstraint.Code || pgErr.ConstraintName != pgErrEmailConstraint.ConstraintName {
			t.Fatalf("want status code and constraint name like %v, got %v", pgErrEmailConstraint, pgErr)
		}
	})

	t.Run("not unique nickname", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		registerRequest := &authpb.RegisterRequest{
			Email: "email", Nickname: "nickname", Password: "password",
		}
		_, err := repo.CreateUser(context.Background(), registerRequest)
		if err != nil {
			t.Fatalf("got error when tried to create user, %v", err)
		}

		// create user with same nickname
		registerRequest.Nickname = "email2"

		_, err = repo.CreateUser(context.Background(), registerRequest)
		var pgErr *pgconn.PgError
		if !errors.As(err, &pgErr) {
			t.Fatalf("want pgError, got %v", err)
		}
		if pgErr.Code != pgErrEmailConstraint.Code || pgErr.ConstraintName != pgErrEmailConstraint.ConstraintName {
			t.Fatalf("want status code and constraint name like %v, got %v", pgErrEmailConstraint, pgErr)
		}
	})
}

func TestGetUserByEmail(t *testing.T) {
	t.Run("happy ending", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		registerRequest := &authpb.RegisterRequest{
			Email: "email", Nickname: "nickname", Password: "password",
		}
		_, err := repo.CreateUser(context.Background(), registerRequest)
		if err != nil {
			t.Fatalf("got error when tried to create user, %v", err)
		}

		user, err := repo.GetUserByEmail(context.Background(), "email")
		if err != nil {
			t.Fatalf("got error when tried to get user by email, %v", err)
		}

		if user.ID == uuid.Nil {
			t.Fatalf("userID cant be nil")
		}

		if user.PasswordHash != registerRequest.Password {
			t.Fatalf("user password is not the same with passed to register, want %v, got %v", registerRequest.Password, user.PasswordHash)
		}
	})

	t.Run("no user found by email", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		_, err := repo.GetUserByEmail(context.Background(), "email")
		if !errors.Is(err, pgx.ErrNoRows) {
			t.Fatalf("want ErrNoRows, got %v", err)
		}
	})
}

func TestGetUserByNickname(t *testing.T) {
	t.Run("happy ending", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		registerRequest := &authpb.RegisterRequest{
			Email: "email", Nickname: "nickname", Password: "password",
		}
		_, err := repo.CreateUser(context.Background(), registerRequest)
		if err != nil {
			t.Fatalf("got error when tried to create user, %v", err)
		}

		user, err := repo.GetUserByNickname(context.Background(), "nickname")
		if err != nil {
			t.Fatalf("got error when tried to get user by nickname, %v", err)
		}
		if user.ID == uuid.Nil {
			t.Fatalf("userID cant be nil")
		}

		if user.PasswordHash != registerRequest.Password {
			t.Fatalf("user password is not the same with passed to register, want %v, got %v", registerRequest.Password, user.PasswordHash)
		}
	})

	t.Run("no user found by nickname", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		_, err := repo.GetUserByNickname(context.Background(), "nickname")
		if !errors.Is(err, pgx.ErrNoRows) {
			t.Fatalf("want ErrNoRows, got %v", err)
		}
	})
}

func TestIsUserExists(t *testing.T) {
	t.Run("happy ending", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		registerRequest := &authpb.RegisterRequest{
			Email: "email", Nickname: "nickname", Password: "password",
		}
		userID, err := repo.CreateUser(context.Background(), registerRequest)
		if err != nil {
			t.Fatalf("got error when tried to create user, %v", err)
		}

		exists, err := repo.IsUserExists(context.Background(), userID)
		if err != nil {
			t.Fatalf("got error when tried to check user existence, %v", err)
		}
		if !exists {
			t.Fatal("user should exist, but got false")
		}
	})

	t.Run("user not found", func(t *testing.T) {
		repo, rollback := setupTxRepo(t)
		defer rollback()

		exists, err := repo.IsUserExists(context.Background(), uuid.Nil)
		if err != nil {
			t.Fatalf("got error when tried to check user existence, %v", err)
		}

		if exists {
			t.Fatalf("want user not exists, got opposite")
		}
	})
}
