package tick

import (
	"context"
	"fmt"
	"time"

	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/config"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/kafka"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/repository"
	"github.com/404-u-team/airlinesim-mono/backend/tick-service/internal/utils"
	"github.com/jackc/pgx/v5"
)

type TickLoop interface {
	Run(ctx context.Context) error
}

type tickLoop struct {
	lastProccessed15Min time.Time
	lastProccessed1Hour time.Time

	kafkaProducer kafka.Producer
	gameStateRepo repository.GameStateRepository
	config        *config.Config
}

func NewTickLoop(kafkaProducer kafka.Producer, gameStateRepo repository.GameStateRepository, config *config.Config) TickLoop {
	return &tickLoop{kafkaProducer: kafkaProducer, gameStateRepo: gameStateRepo, config: config}
}

func (tl *tickLoop) Run(ctx context.Context) error {
	// get initial state of game in db
	lastProccessed15Min, lastProccessed1Hour, err := tl.gameStateRepo.GetState(ctx)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("got error when tried to get state from repository, %w", err)
	}
	if err == pgx.ErrNoRows {
		tl.lastProccessed15Min = time.Unix(tl.config.StartGameTime, 0)
		tl.lastProccessed1Hour = time.Unix(tl.config.StartGameTime, 0)
	} else {
		tl.lastProccessed15Min = lastProccessed15Min
		tl.lastProccessed1Hour = lastProccessed1Hour
	}

	for {
		currentGameTime := utils.CurrentGameTime(tl.config)

		// check is enough time elapsed (15 min)
		if currentGameTime.Sub(tl.lastProccessed15Min) > time.Minute*15 {
			// send event - elapsed 15 min
			err := tl.kafkaProducer.Send(ctx, kafka.Topic15Min, nil, nil)
			if err != nil {
				return fmt.Errorf("got error when tried to send event using kafka, %w", err)
			}

			// put new processed time inside struct and db
			newLastProcessed15Min := tl.lastProccessed15Min.Add(time.Minute * 15)
			tl.lastProccessed15Min = newLastProcessed15Min
			err = tl.gameStateRepo.SetLastProcessed15Min(ctx, newLastProcessed15Min)
			if err != nil {
				return fmt.Errorf("got error when tried to set last processed 15 min in tick loop, %w", err)
			}
		}

		// check is enough time elapsed (1 hour)
		if currentGameTime.Sub(tl.lastProccessed1Hour) > time.Hour {
			// send event - elapsed 1 hour
			err := tl.kafkaProducer.Send(ctx, kafka.Topic1Hour, nil, nil)
			if err != nil {
				return fmt.Errorf("got error when tried to send event using kafka, %w", err)
			}

			// put new processed time inside struct and db
			newLastProcessed1Hour := tl.lastProccessed1Hour.Add(time.Hour)
			tl.lastProccessed1Hour = newLastProcessed1Hour
			err = tl.gameStateRepo.SetLastProcessed1Hour(ctx, newLastProcessed1Hour)
			if err != nil {
				return fmt.Errorf("got error when tried to set last processed 1 hour in tick loop, %w", err)
			}
		}

		// small sleep
		time.Sleep(time.Second)
	}
}
