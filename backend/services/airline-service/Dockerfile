# --- Build stage ---
FROM golang:1.26.2-alpine AS build

WORKDIR /src/backend/services/airline-service

RUN apk add --no-cache ca-certificates

COPY backend/services/airline-service/go.mod backend/services/airline-service/go.sum ./
COPY backend/shared/contracts/proto/airline/go.mod backend/shared/contracts/proto/airline/go.sum /src/backend/shared/contracts/proto/airline/
COPY backend/shared/contracts/proto/fleet/go.mod backend/shared/contracts/proto/fleet/go.sum /src/backend/shared/contracts/proto/fleet/
COPY backend/shared/contracts/proto/auth/go.mod backend/shared/contracts/proto/auth/go.sum /src/backend/shared/contracts/proto/auth/
COPY backend/shared/customerrors/go.mod backend/shared/customerrors/go.sum /src/backend/shared/customerrors/

# installing packages
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	go mod download

COPY backend/services/airline-service/ ./
COPY backend/shared/contracts/proto/airline/ /src/backend/shared/contracts/proto/airline/
COPY backend/shared/contracts/proto/fleet/ /src/backend/shared/contracts/proto/fleet/
COPY backend/shared/contracts/proto/auth/ /src/backend/shared/contracts/proto/auth/
COPY backend/shared/customerrors/ /src/backend/shared/customerrors/

# building runtime file
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOOS=linux go build -o /out/airline-service ./cmd/server


# --- Runtime stage ---
FROM alpine:3.21 AS runtime

RUN apk add --no-cache ca-certificates \
	&& addgroup -S appgroup \
	&& adduser -S -H -u 10001 -G appgroup appuser

WORKDIR /app

COPY --from=build /out/airline-service ./airline-service
COPY --chown=appuser:appgroup backend/shared/config/.env /shared/config/.env
COPY --chown=appuser:appgroup backend/services/airline-service/internal/db/migrations ./migrations

# setting user rights and folder mode
RUN chmod 755 /app/airline-service \
	&& chown -R appuser:appgroup /app

EXPOSE 50051

USER appuser

ENTRYPOINT ["/app/airline-service"]
