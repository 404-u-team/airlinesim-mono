package dto

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID           uuid.UUID
	Email        string
	Nickname     string
	PasswordHash string
	Role         string
	CreatedAt    time.Time
}
