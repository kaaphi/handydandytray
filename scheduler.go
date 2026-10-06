package main

import (
	"bytes"
	"slices"
	"time"
	"uuid"

	"github.com/go-co-op/gocron/v2"
	guuid "github.com/google/uuid"
)

type Scheduler struct {
	scheduler gocron.Scheduler
}

func NewScheduler() (*Scheduler, error) {
	scheduler, err := gocron.NewScheduler()

	if err != nil {
		return nil, err
	}

	scheduler.Start()

	return &Scheduler{
		scheduler: scheduler,
	}, nil
}

func (g *Scheduler) Shutdown() error {
	return g.scheduler.Shutdown()
}

func (g *Scheduler) ScheduleOneShot(id uuid.UUID, tag string, at time.Time, function any, parameters ...any) error {
	jobDefinition := gocron.OneTimeJob(
		gocron.OneTimeJobStartDateTime(at),
	)
	jobTask := gocron.NewTask(
		function, parameters...,
	)

	var err error
	if g.jobExists(id) {
		_, err = g.scheduler.Update(guuid.UUID(id),
			jobDefinition,
			jobTask,
			gocron.WithTags(tag),
		)
	} else {
		_, err = g.scheduler.NewJob(
			jobDefinition,
			jobTask,
			gocron.WithIdentifier(guuid.UUID(id)),
			gocron.WithTags(tag),
		)
	}
	return err
}

func (g *Scheduler) RemoveAll(tag string) {
	g.scheduler.RemoveByTags(tag)
}

func (g *Scheduler) RemoveJob(id uuid.UUID) error {
	if g.jobExists(id) {
		return g.scheduler.RemoveJob(guuid.UUID(id))
	}

	return nil
}

func (g *Scheduler) jobExists(id uuid.UUID) bool {
	_, found := slices.BinarySearchFunc(g.scheduler.Jobs(), guuid.UUID(id), func(job gocron.Job, id guuid.UUID) int {
		jobId := job.ID()
		return bytes.Compare(jobId[:], id[:])
	})

	return found
}
