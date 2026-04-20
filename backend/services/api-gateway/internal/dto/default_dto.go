package dto

import "github.com/google/uuid"

type ErrorResponse struct {
	ErrorCode int `json:"error"`
}

type IDResponse struct {
	ID uuid.UUID `json:"id"`
}
