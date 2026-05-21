# Agents.md

## Backend Overview

This repository is a Go microservice backend for AirlineSim.

### Top-level layout

- `backend/services/` contains one Go module per service.
- `backend/shared/contracts/proto/` contains checked-in protobuf contracts and generated Go code.
- `backend/shared/customerrors/` contains shared gRPC error helpers.
- `backend/shared/config/` contains shared runtime environment values, especially Kafka/game-time settings.
- `backend/infrustructure/docker/` contains the main compose stack for the backend.
- `backend/infrustructure/docs/` contains the docs-only compose file for API reference.

### Services

- `auth-service`: user auth, JWT, password hashing, gRPC auth API, Postgres.
- `operations-service`: countries, regions, airports, fuel price events, gRPC + Kafka + Postgres.
- `airline-service`: airline creation, airport view cache, auth gRPC client, Kafka consumer.
- `tick-service`: game-time tick loop, Kafka producer, persists tick state in Postgres.
- `fleet-service`: aircraft/fleet schema and service scaffold.
- `api-gateway`: HTTP API, Socket.IO, auth/operations gRPC clients, Kafka consumer for realtime events.

## Working Rules

- Prefer the existing per-service patterns instead of inventing new abstractions.
- Keep each service self-contained inside its own Go module.
- Shared contract changes should be made under `backend/shared/contracts/proto/<service>/` and then regenerated if needed.
- Do not rename directories like `infrustructure/` unless the whole repo is being cleaned up intentionally.
- Do not revert user changes that you did not make.
- Use `apply_patch` for file edits.

## Config Patterns

- Every service has its own `internal/config/config.go`.
- Most services load `.env` from multiple relative paths with `godotenv.Load(...)`.
- Runtime containers should have access to shared config values via `backend/shared/config/.env` when Kafka/game-time settings are needed.
- Kafka brokers inside Docker should use the internal listener, not the external one.

## Kafka Conventions

- Internal service-to-Kafka traffic should use `kafka:29092`.
- External/local host access may use `localhost:9092`.
- Kafka topic names currently used by the backend include:
  - `operations_airport_created`
  - `operations_airports_deleted`
  - `operations_fuel_price_changed`
  - `tick_15_min_elapsed`
  - `tick_1_hour_elapsed`

## Compose / Containers

- Main backend compose file: `backend/infrustructure/docker/docker-compose.yaml`.
- Docs compose file: `backend/infrustructure/docs/docker-compose.yaml`.
- Run the full backend from the repository root.
- Compose services should use valid build contexts relative to the repo root.
- PostgreSQL 18+ volumes should mount to `/var/lib/postgresql`, not `/var/lib/postgresql/data`.

## Build / Validation

- Run a single service tests with:
  - `cd backend/services/<service> && go test ./...`
- Run module cleanup with:
  - `cd backend/services/<service> && go mod tidy`
- Validate compose files with:
  - `docker compose -f backend/infrustructure/docker/docker-compose.yaml config`
  - `docker compose -f backend/infrustructure/docs/docker-compose.yaml config`
- Build images from repo root with:
  - `docker build -f backend/services/<service>/Dockerfile -t <service>-test .`

## Current Implementation Notes

- `tick-service` computes game time from `START_REAL_TIME`, `START_GAME_TIME`, and `TIME_MULTIPLIER`.
- `tick-service` should not emit ticks once per real second just because game time is ahead; it must start from current game time when not replaying missed events.
- `api-gateway` exposes HTTP and Socket.IO on the same port.
- Swagger/OpenAPI docs for the gateway are generated under `backend/services/api-gateway/cmd/gateway/docs`.
- `fleet-service` currently has schema and scaffolding; its gRPC surface is still empty.

## Error Handling Expectations

- Use shared gRPC errors from `backend/shared/customerrors/errors.go`.
- Preserve existing error mapping behavior unless a bug fix explicitly requires changing it.
- When fixing runtime issues, validate the narrowest affected service first.
