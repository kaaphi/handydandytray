package timetracking

import (
	"errors"
	"handydandytray/internal/services"
	"log/slog"
	"os"
	"testing"
	"time"
	_ "time/tzdata"

	"github.com/alecthomas/assert/v2"
	"github.com/wailsapp/wails/v3/pkg/application"
)

const testDbPath = "test_timetracking.db"

func getTodayAt(hour int) time.Time {
	now := time.Now()
	year, month, day := now.Date()

	return time.Date(year, month, day, hour, 0, 0, 0, now.Location())
}

func TestDatabaseGroup(t *testing.T) {
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

	teardown := func(t *testing.T) {
		_, err := dbService.Db.ExecContext(t.Context(), "DELETE FROM timetracking_intervals")
		assert.NoError(t, err)
	}

	loc, err := time.LoadLocation("America/Los_Angeles")
	assert.NoError(t, err)

	// Override Go's global local timezone for the test process
	time.Local = loc

	t.Run("verifyTimeZone", func(t *testing.T) {
		now := time.Now()
		expectedLocation, err := time.LoadLocation("America/Los_Angeles")
		assert.NoError(t, err)

		for i := range 12 {
			compareTime := now.AddDate(0, -i, 0)
			assert.Equal(t, compareTime.In(expectedLocation).Format(time.RFC3339), compareTime.In(time.Local).Format(time.RFC3339))
		}
	})

	t.Run("testInsertAndGetStats", func(t *testing.T) {
		defer teardown(t)

		startTime := getTodayAt(8).AddDate(0, 0, -2)
		assert.NoError(t, service.AddInterval(t.Context(), &Interval{
			Start: startTime,
			End:   startTime.Add(time.Hour * 1),
			Activities: map[string]int{
				"stuff":   20,
				"cooking": 10,
				"things":  30,
			},
		}))
		assert.NoError(t, service.AddInterval(t.Context(), &Interval{
			Start: startTime.AddDate(0, 0, 1),
			End:   startTime.AddDate(0, 0, 1).Add(time.Hour * 1),
			Activities: map[string]int{
				"stuff": 5,
			},
		}))

		result, err := service.GetTimeTrackingDateStats(t.Context(), startTime, time.Now())
		assert.NoError(t, err)

		assert.Equal(t, &TimeTrackingStats{
			TotalDurationMinutes: 65,
			TotalsByCategory: []Category{
				{
					Name:                 "default",
					TotalDurationMinutes: 55,
					Activities: []Activity{
						{
							Name:            "stuff",
							DurationMinutes: 25,
						},
						{
							Name:            "things",
							DurationMinutes: 30,
						},
					},
				},
				{
					Name:                 "kitchen",
					TotalDurationMinutes: 10,
					Activities: []Activity{
						{
							Name:            "cooking",
							DurationMinutes: 10,
						},
					},
				},
			},
			Dates: []DateStats{
				{
					Date:                 startTime.Format("2006-01-02"),
					TotalDurationMinutes: 60,
					Categories: []Category{
						{
							Name:                 "default",
							TotalDurationMinutes: 50,
							Activities: []Activity{
								{
									Name:            "stuff",
									DurationMinutes: 20,
								},
								{
									Name:            "things",
									DurationMinutes: 30,
								},
							},
						},
						{
							Name:                 "kitchen",
							TotalDurationMinutes: 10,
							Activities: []Activity{
								{
									Name:            "cooking",
									DurationMinutes: 10,
								},
							},
						},
					},
				},
				{
					Date:                 startTime.AddDate(0, 0, 1).Format("2006-01-02"),
					TotalDurationMinutes: 5,
					Categories: []Category{{
						Name:                 "default",
						TotalDurationMinutes: 5,
						Activities: []Activity{{
							Name:            "stuff",
							DurationMinutes: 5,
						}},
					}},
				},
			},
		}, result)
	})

	t.Run("test crossing UTC date boundary is still one date in local", func(t *testing.T) {
		defer teardown(t)

		startTime1 := getTodayAt(1).AddDate(0, 0, -2)
		assert.NoError(t, service.AddInterval(t.Context(), &Interval{
			Start: startTime1,
			End:   startTime1.Add(time.Hour * 1),
			Activities: map[string]int{
				"stuff":   20,
				"cooking": 10,
				"things":  30,
			},
		}))
		startTime2 := getTodayAt(23).AddDate(0, 0, -2)
		assert.NoError(t, service.AddInterval(t.Context(), &Interval{
			Start: startTime2,
			End:   startTime2.Add(time.Hour * 1),
			Activities: map[string]int{
				"stuff": 5,
			},
		}))
		assert.Equal(t, startTime1.Format("2006-01-02"), startTime2.Format("2006-01-02"))

		result, err := service.GetTimeTrackingDateStats(t.Context(), startTime1, time.Now())
		assert.NoError(t, err)

		expectedCategoryTotals := []Category{
			{
				Name:                 "default",
				TotalDurationMinutes: 55,
				Activities: []Activity{
					{
						Name:            "stuff",
						DurationMinutes: 25,
					},
					{
						Name:            "things",
						DurationMinutes: 30,
					},
				},
			},
			{
				Name:                 "kitchen",
				TotalDurationMinutes: 10,
				Activities: []Activity{
					{
						Name:            "cooking",
						DurationMinutes: 10,
					},
				},
			},
		}

		assert.Equal(t, &TimeTrackingStats{
			TotalDurationMinutes: 65,
			TotalsByCategory:     expectedCategoryTotals,
			Dates: []DateStats{
				{
					Date:                 startTime1.Format("2006-01-02"),
					TotalDurationMinutes: 65,
					Categories:           expectedCategoryTotals,
				},
			},
		}, result)
	})
}
