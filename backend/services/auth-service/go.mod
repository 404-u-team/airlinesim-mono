module github.com/404-u-team/airlinesim-mono/backend/auth-service

go 1.26.2

require (
	github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth v0.0.0-00010101000000-000000000000
	github.com/golang-jwt/jwt v3.2.2+incompatible
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.9.1
	github.com/pressly/goose v2.7.0+incompatible
	golang.org/x/crypto v0.50.0
	google.golang.org/grpc v1.80.0
)

replace github.com/404-u-team/airlinesim-mono/backend/shared/contracts/proto/auth => ../../shared/contracts/proto/auth

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	golang.org/x/net v0.52.0 // indirect
	golang.org/x/sync v0.20.0 // indirect
	golang.org/x/sys v0.43.0 // indirect
	golang.org/x/text v0.36.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260120221211-b8f7ae30c516 // indirect
	google.golang.org/protobuf v1.36.11 // indirect
)
