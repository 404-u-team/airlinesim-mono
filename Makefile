COMPOSE_FILE := backend/infrustructure/docker/docker-compose.yaml
GATEWAY_DIR := backend/services/api-gateway/cmd/gateway
SWAGGER_CMD := swag init -g main.go --dir ./,../../internal/handlers,../../internal/dto,../../../../shared/contracts/proto/world

.PHONY: swagger compose-up up

swagger:
	cd $(GATEWAY_DIR) && $(SWAGGER_CMD)

compose-up:
	docker compose -f $(COMPOSE_FILE) up --build

github-push:
	git push origin backend

up: swagger compose-up

swagger-and-push: swagger github-push