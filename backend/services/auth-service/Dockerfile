FROM golang:1.26.2-alpine AS build

WORKDIR /src/backend/services/auth-service

RUN apk add --no-cache ca-certificates

COPY backend/services/auth-service/go.mod backend/services/auth-service/go.sum ./
COPY backend/shared/contracts/proto/auth/go.mod backend/shared/contracts/proto/auth/go.sum /src/backend/shared/contracts/proto/auth/
COPY backend/shared/customerrors/go.mod backend/shared/customerrors/go.sum /src/backend/shared/customerrors/

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	go mod download

COPY backend/services/auth-service/ ./
COPY backend/shared/contracts/proto/auth/ /src/backend/shared/contracts/proto/auth/
COPY backend/shared/customerrors/ /src/backend/shared/customerrors/

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOOS=linux go build -o /out/auth-service ./cmd/server

FROM alpine:3.21 AS runtime

RUN apk add --no-cache ca-certificates \
	&& addgroup -S appgroup \
	&& adduser -S -H -u 10001 -G appgroup appuser

WORKDIR /app

COPY --from=build /out/auth-service ./auth-service
COPY --chown=appuser:appgroup backend/services/auth-service/internal/config/public_key.pem ./public_key.pem
COPY --chown=appuser:appgroup backend/services/auth-service/internal/config/private_key.pem ./private_key.pem
COPY --chown=appuser:appgroup backend/services/auth-service/internal/db/migrations ./migrations

RUN chmod 755 /app/auth-service \
	&& chown -R appuser:appgroup /app

EXPOSE 50051

USER appuser

ENTRYPOINT ["/app/auth-service"]
