package timetracking

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"handydandytray/internal/services"
	"log/slog"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type TimeTrackingService struct {
	logger          *slog.Logger
	dbService       *services.DbService
	db              *sql.DB
	configService   ConfigProvider
	CurrentBaseline time.Time
}

type Interval struct {
	Start time.Time
	End   time.Time
	//map of activity names to duration in minutes for the interval
	Activities map[string]int
}

type DateStats struct {
	Date       string
	Activities map[string]map[string]int
}

type ConfigProvider interface {
	Config() *services.Config
}

func NewTimeTrackingService(logger *slog.Logger, dbService *services.DbService, configService ConfigProvider) *TimeTrackingService {
	return &TimeTrackingService{
		logger:          logger,
		dbService:       dbService,
		configService:   configService,
		CurrentBaseline: time.Now(),
	}
}

func (g *TimeTrackingService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	if g.dbService.Db == nil {
		return errors.New("DB is not initialized!")
	}
	g.db = g.dbService.Db

	return nil
}

func (g *TimeTrackingService) GetConfig(ctx context.Context) services.TimeTrackingConfig {
	return g.configService.Config().Timetracking
}

func (g *TimeTrackingService) AddInterval(ctx context.Context, interval *Interval) error {
	tx, err := g.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	query := `INSERT INTO timetracking_intervals (interval_start, interval_end, activity, activity_minutes) VALUES (?, ?, ?, ?)`

	for activity, durationMinutes := range interval.Activities {
		_, err := tx.ExecContext(ctx, query, interval.Start, interval.End, activity, durationMinutes)
		if err != nil {
			return fmt.Errorf("insert interval entry: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit interval transaction: %w", err)
	}

	return nil
}

func (g *TimeTrackingService) GetBaselineForNextInterval(ctx context.Context) (time.Time, error) {
	query := `
	SELECT interval_end FROM timetracking_intervals ORDER BY interval_start DESC LIMIT 1
	`
	var intervalEnd time.Time

	rows, err := g.db.Query(query)
	if err != nil {
		return intervalEnd, fmt.Errorf("Failed to get time tracking data: %w", err)
	}
	defer rows.Close()

	if rows.Next() {
		if err := rows.Scan(&intervalEnd); err != nil {
			return intervalEnd, fmt.Errorf("scan timetracking_intervals row: %w", err)
		}
	} else {
		return g.CurrentBaseline, nil
	}

	if err := rows.Err(); err != nil {
		return intervalEnd, fmt.Errorf("rows iteration: %w", err)
	}

	if g.CurrentBaseline.Before(intervalEnd) {
		return intervalEnd, nil
	} else {
		return g.CurrentBaseline, nil
	}
}

func (g *TimeTrackingService) GetRecentActivities(ctx context.Context, daysBack int) ([]string, error) {
	query := `
	SELECT DISTINCT activity FROM timetracking_intervals WHERE interval_start > ?
	`

	rows, err := g.db.Query(query, time.Now().AddDate(0, 0, -daysBack))
	if err != nil {
		return nil, fmt.Errorf("Failed to get time tracking data: %w", err)
	}
	defer rows.Close()

	activities := make([]string, 0)

	for rows.Next() {
		var activity string

		if err := rows.Scan(&activity); err != nil {
			return nil, fmt.Errorf("scan timetracking_intervals row: %w", err)
		}

		activities = append(activities, activity)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return activities, nil
}

func (g *TimeTrackingService) getCategoryByActivities() map[string]string {
	timetrackingConfig := g.configService.Config().Timetracking
	activityByCategory := make(map[string]string)
	for category, activities := range timetrackingConfig.CategoryActivities {
		for _, activity := range activities {
			activityByCategory[activity] = category
		}
	}
	return activityByCategory
}

func (g *TimeTrackingService) GetTimeTrackingDateStats(ctx context.Context, start time.Time, end time.Time) ([]DateStats, error) {
	query := `
	SELECT date(interval_start) AS interval_date, activity, SUM(activity_minutes) FROM timetracking_intervals
	WHERE interval_start >= ? AND interval_start < ?
	GROUP BY interval_date, activity
	ORDER BY interval_date ASC
	`

	rows, err := g.db.Query(query, start, end)
	if err != nil {
		return nil, fmt.Errorf("Failed to get time tracking data: %w", err)
	}
	defer rows.Close()

	stats := make([]DateStats, 0)
	categoryByActivity := g.getCategoryByActivities()
	defaultCategory := g.configService.Config().Timetracking.DefaultCategory

	for rows.Next() {
		var intervalDate string
		var activity string
		var activityMinutes int
		if err := rows.Scan(&intervalDate, &activity, &activityMinutes); err != nil {
			return nil, fmt.Errorf("scan timetracking_intervals row: %w", err)
		}

		// Append a new DateStats whenever the date changes or on the first iteration
		if len(stats) == 0 || stats[len(stats)-1].Date != intervalDate {
			stats = append(stats, DateStats{
				Date:       intervalDate,
				Activities: make(map[string]map[string]int),
			})
		}
		category := categoryByActivity[activity]
		if category == "" {
			category = defaultCategory
		}
		// Add activity to the most recent DateStats
		activities := stats[len(stats)-1].Activities[category]
		if activities == nil {
			activities = make(map[string]int)
			stats[len(stats)-1].Activities[category] = activities
		}
		activities[activity] = activityMinutes
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return stats, nil
}
