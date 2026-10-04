package main

import (
	"time"
	"uuid"

	"github.com/go-co-op/gocron/v2"
	guuid "github.com/google/uuid"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type Scheduler struct {
	scheduler gocron.Scheduler
}

func NewScheduler(app *application.App) (*Scheduler, error) {
	scheduler, err := gocron.NewScheduler()

	if err != nil {
		return nil, err
	}

	app.OnShutdown(func() {
		err := scheduler.Shutdown()

		if err != nil {
			app.Logger.Error("Failed to shutdown scheduler", "error", err)
		}
	})

	return &Scheduler{
		scheduler: scheduler,
	}, nil
}

func (g *Scheduler) ScheduleOneShot(id uuid.UUID, at time.Time, function any) {
	g.scheduler.NewJob(
		gocron.OneTimeJob(
			gocron.OneTimeJobStartDateTime(at),
		),
		gocron.NewTask(
			function,
		),
		gocron.WithIdentifier(guuid.UUID(id)),
	)
}

func (g *Scheduler) RemoveJob(id uuid.UUID) error {
	return g.scheduler.RemoveJob(guuid.UUID(id))
}
