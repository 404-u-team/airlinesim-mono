FROM golang:1.26.2-alpine AS build

WORKDIR /src/backend/services/api-gateway

RUN apk add --no-cache ca-certificates

COPY backend/services/api-gateway/go.mod backend/services/api-gateway/go.sum ./
COPY backend/shared/contracts/proto/auth/go.mod backend/shared/contracts/proto/auth/go.sum /src/backend/shared/contracts/proto/auth/

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	go mod download

COPY backend/services/api-gateway/ ./
COPY backend/shared/contracts/proto/auth/ /src/backend/shared/contracts/proto/auth/

RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOOS=linux go build -o /out/api-gateway ./cmd/gateway

FROM alpine:3.21 AS runtime

RUN apk add --no-cache ca-certificates \
	&& addgroup -S appgroup \
	&& adduser -S -H -u 10001 -G appgroup appuser

WORKDIR /app

COPY --from=build /out/api-gateway ./api-gateway
COPY --chown=appuser:appgroup backend/services/api-gateway/internal/config/public_key.pem ./public_key.pem

RUN chmod 755 /app/api-gateway \
	&& chown -R appuser:appgroup /app

EXPOSE 8080

USER appuser

ENTRYPOINT ["/app/api-gateway"]
