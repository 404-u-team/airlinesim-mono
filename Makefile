COMPOSE_FILE := backend/infrustructure/docker/docker-compose.yaml
GATEWAY_DIR := backend/services/api-gateway/cmd/gateway
FRONTEND_DOCS_DIR := frontend/docs
SWAGGER_CMD := swag init -g main.go --dir ./,../../internal/handlers,../../internal/dto,../../../../shared/contracts/proto/airline,../../../../shared/contracts/proto/operations,../../../../shared/contracts/proto/fleet

.PHONY: swagger compose-up up

swagger:
	cd $(GATEWAY_DIR) && $(SWAGGER_CMD)
	mkdir -p $(FRONTEND_DOCS_DIR)
	cp -R $(GATEWAY_DIR)/docs/. $(FRONTEND_DOCS_DIR)

swagger-commit:
		git add $(GATEWAY_DIR)/docs/* && git commit -m "Autogenerate swagger docs"
compose-up:
	docker compose -f $(COMPOSE_FILE) up --build

github-push:
	git push origin master

up: swagger compose-up

swagger-and-push: swagger swagger-commit github-push