# --- Build stage ---
FROM golang:1.26.2-alpine AS build

WORKDIR /src/backend/services/game-service

RUN apk add --no-cache ca-certificates

COPY backend/services/game-service/go.mod backend/services/game-service/go.sum ./

# installing packages
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	go mod download

COPY backend/services/game-service/ ./

# building runtime file
RUN --mount=type=cache,target=/go/pkg/mod \
	--mount=type=cache,target=/root/.cache/go-build \
	CGO_ENABLED=0 GOOS=linux go build -o /out/game-service ./cmd/server


# --- Runtime stage ---
FROM alpine:3.21 AS runtime

RUN apk add --no-cache ca-certificates \
	&& addgroup -S appgroup \
	&& adduser -S -H -u 10001 -G appgroup appuser

WORKDIR /app

COPY --from=build /out/game-service ./game-service
COPY --chown=appuser:appgroup backend/services/game-service/internal/config/public_key.pem ./public_key.pem

# setting user rights and folder mode
RUN chmod 755 /app/game-service \
	&& chown -R appuser:appgroup /app

EXPOSE 8080

USER appuser

ENTRYPOINT ["/app/game-service"]
