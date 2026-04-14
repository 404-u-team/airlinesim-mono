# --- Build stage ---
FROM golang:1.26-alpine AS builder

ENV CGO_ENABLED=0 \
	GOOS=linux \
	GOARCH=amd64

RUN apk add --no-cache git ca-certificates
WORKDIR /src

COPY backend/services/auth-service/go.mod backend/services/auth-service/go.sum ./
RUN go mod download

COPY backend/services/auth-service ./
COPY backend/shared ./backend/shared

RUN --mount=type=cache,target=/root/.cache/go-build \
	go build -trimpath -ldflags='-s -w' -o /app/server ./cmd/server


# --- Runtime stage ---
FROM alpine:3.18
RUN apk add --no-cache ca-certificates
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/server ./server

USER appuser

ENV PORT=50051
EXPOSE 50051
CMD ["./server"]