package utils

import (
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/config"
)

func CurrentGameTime(config *config.Config) time.Time {
	elapsedRealSeconds := time.Now().Unix() - config.StartRealTime
	elapsedGameSeconds := elapsedRealSeconds * config.TimeMultiplier
	gameUnixSeconds := config.StartGameTime + elapsedGameSeconds
	return time.Unix(gameUnixSeconds, 0)
}
