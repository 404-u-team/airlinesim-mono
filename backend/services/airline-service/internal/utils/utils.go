package utils

import (
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/airline-service/internal/config"
)

func CurrentGameTime(config *config.Config) time.Time {
	currentGameTimeUnix := (time.Now().Unix()-config.StartRealTime)*config.TimeMultiplier + config.StartGameTime
	return time.Unix(currentGameTimeUnix, 0)
}
