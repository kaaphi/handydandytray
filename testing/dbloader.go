package main

import (
	"context"
	"handydandytray/internal/services"
	"handydandytray/internal/timetracking"
	"log"
	"log/slog"
	"math/rand/v2"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func CreateRandomHourInterval(start time.Time, activities ...string) *timetracking.Interval {
	activitiesMap := make(map[string]int)

	minutesRemaining := 60
	for iteration, idx := range rand.Perm(len(activities)) {
		activity := activities[idx]
		if minutesRemaining < 1 {
			continue
		} else if iteration == (len(activities) - 1) {
			activitiesMap[activity] = minutesRemaining
			continue
		}

		durationSeed := rand.IntN(minutesRemaining*2) - (minutesRemaining / 2)
		if durationSeed < 1 {
			continue
		}

		duration := min(durationSeed, minutesRemaining)
		minutesRemaining -= duration
		activitiesMap[activity] = duration
	}

	return &timetracking.Interval{
		Start:      start,
		End:        start.Add(1 * time.Hour),
		Activities: activitiesMap,
	}
}

func getTodayAt(hour int) time.Time {
	now := time.Now()
	year, month, day := now.Date()

	return time.Date(year, month, day, hour, 0, 0, 0, now.Location())
}

func main() {
	dbService := services.NewDbService(slog.Default(), "test.db")
	if err := dbService.ServiceStartup(context.Background(), application.DefaultServiceOptions); err != nil {
		log.Fatal(err)
	}
	defer func() {
		if err := dbService.ServiceShutdown(); err != nil {
			log.Fatal(err)
		}
	}()

	configService := services.NewSimpleConfigService(&services.Config{
		Timetracking: services.TimeTrackingConfig{
			DefaultCategory: "work",
			CategoryActivities: map[string][]string{
				"non-work": {"staring"},
			},
		},
	})

	service := timetracking.NewTimeTrackingService(slog.Default(), dbService, configService)
	if err := service.ServiceStartup(context.Background(), application.DefaultServiceOptions); err != nil {
		log.Fatal(err)
	}

	start := getTodayAt(8).AddDate(0, 0, -10)

	for d := 0; d < 10; d++ {
		startOfDay := start.AddDate(0, 0, d)
		for h := 0; h < 8; h++ {
			if err := service.AddInterval(context.Background(), CreateRandomHourInterval(startOfDay.Add(time.Duration(h)*time.Hour), "work", "other", "browsing")); err != nil {
				log.Fatal(err)
			}
		}
	}
}
