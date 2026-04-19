package handlers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/events"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/kafka"
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/services"
)

type ImportHandler struct {
	importService services.ImportService
	producer      kafka.Producer
}

func NewImportHandler(importService services.ImportService, producer kafka.Producer) *ImportHandler {
	return &ImportHandler{importService: importService, producer: producer}
}

func (h *ImportHandler) ImportReceived(ctx context.Context, data []byte) error {
	var event events.ImportDataReceivedEvent
	if err := json.Unmarshal(data, &event); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	err := h.importService.ImportReceived(ctx, &event)
	if err != nil {
		return fmt.Errorf("error in import service: %w", err)
	}

	// Smth to say that import is success
	return nil
}
