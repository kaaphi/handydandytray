package timetracking

import (
	"errors"
	"handydandytray/internal/services"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

const testDbPath = "test_timetracking.db"

func getTodayAt(hour int) time.Time {
	now := time.Now()
	year, month, day := now.Date()

	return time.Date(year, month, day, hour, 0, 0, 0, now.Location())
}

func TestGroup(t *testing.T) {
	_, err := os.Stat(testDbPath)
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("%s db file already exists or there was another error reading it: %v", testDbPath, err)
	}

	dbService := services.NewDbService(slog.Default(), testDbPath)
	dbService.ServiceStartup(t.Context(), application.DefaultServiceOptions)
	service := NewTimeTrackingService(slog.Default(), dbService, services.NewSimpleConfigService(&services.Config{
		Timetracking: services.TimeTrackingConfig{
			DefaultCategory: "default",
			Categories:      []services.TimeTrackingCategory{{Name: "kitchen", Activities: []string{"cooking"}}},
		},
	}))
	service.ServiceStartup(t.Context(), application.DefaultServiceOptions)

	t.Cleanup(func() {
		if err := dbService.ServiceShutdown(); err != nil {
			t.Errorf("Failed to shutdown db: %v", err)
		}
		if err := os.Remove(testDbPath); err != nil {
			t.Errorf("Failed to remove db file: %v", err)
		}
	})

	t.Run("testInsert", func(t *testing.T) {
		startTime := getTodayAt(8).AddDate(0, 0, -1)
		service.AddInterval(t.Context(), &Interval{
			Start: startTime,
			End:   startTime.Add(time.Hour * 1),
			Activities: map[string]int{
				"stuff":   20,
				"cooking": 10,
				"things":  30,
			},
		})

		result, err := service.GetTimeTrackingDateStats(t.Context(), startTime, time.Now())

		if err != nil {
			t.Errorf("Failed to get data! %s", err)
		}

		if len(result.Dates) != 1 {
			t.Errorf("Wrong size!")
		}

		if result.TotalDurationMinutes != 60 {
			t.Errorf("Bad TotalDurationMinutes value!")
		}

		if result.TotalsByCategory[0].Name != "default" || result.TotalsByCategory[0].TotalDurationMinutes != 50 {
			t.Errorf("Bad default TotalDurationMinutes value! %d", result.TotalsByCategory[0].TotalDurationMinutes)
		}

		if result.TotalsByCategory[1].Name != "kitchen" || result.TotalsByCategory[1].TotalDurationMinutes != 10 {
			t.Errorf("Bad kitchen TotalDurationMinutes value! %d", result.TotalsByCategory[1].TotalDurationMinutes)
		}

		if result.TotalsByCategory[0].Activities[0].Name != "stuff" || result.TotalsByCategory[0].Activities[0].DurationMinutes != 20 {
			t.Errorf("Bad total activity duration for cooking!")
		}

	})
}
