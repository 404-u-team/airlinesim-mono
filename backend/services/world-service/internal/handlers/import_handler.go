package handlers

import (
	"github.com/404-u-team/airlinesim-mono/backend/game-service/internal/services"
)

type ImportHandler struct {
	importService services.ImportService
}

func NewImportHandler(importService services.ImportService) *ImportHandler {
	return &ImportHandler{importService: importService}
}
