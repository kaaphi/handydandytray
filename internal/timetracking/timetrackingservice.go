package timetracking

import (
	"cmp"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"handydandytray/internal/services"
	"log/slog"
	"slices"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type TimeTrackingService struct {
	logger          *slog.Logger
	dbService       *services.DbService
	db              *sql.DB
	configService   ConfigProvider
	appStart        time.Time
	currentBaseline time.Time
}

type IntervalStartBaselines struct {
	AppStart        time.Time `json:"appStart,omitzero"`
	Manual          time.Time `json:"manual,omitzero"`
	LastintervalEnd time.Time `json:"lastIntervalEnd,omitzero"`
}

type Interval struct {
	Start time.Time
	End   time.Time
	//map of activity names to duration in minutes for the interval
	Activities map[string]int
}

type dbDateStats struct {
	date       string
	activities map[string]map[string]int
}

type TimeTrackingStats struct {
	Dates                []DateStats
	TotalDurationMinutes int
	TotalsByCategory     []Category
}

type DateStats struct {
	Date                 string
	TotalDurationMinutes int
	Categories           []Category
}

type Category struct {
	Name                 string
	TotalDurationMinutes int
	Activities           []Activity
}

type Activity struct {
	Name            string
	DurationMinutes int
}

type ConfigProvider interface {
	Config() *services.Config
}

func NewTimeTrackingService(logger *slog.Logger, dbService *services.DbService, configService ConfigProvider) *TimeTrackingService {
	return &TimeTrackingService{
		logger:        logger,
		dbService:     dbService,
		configService: configService,
		appStart:      time.Now(),
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
		_, err := tx.ExecContext(ctx, query, interval.Start.UTC(), interval.End.UTC(), activity, durationMinutes)
		if err != nil {
			return fmt.Errorf("insert interval entry: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit interval transaction: %w", err)
	}

	return nil
}

func (g *TimeTrackingService) UpdateDefaultBaselineForNextInterval(ctx context.Context, baseline time.Time) {
	g.currentBaseline = baseline
}

func (g *TimeTrackingService) GetBaselineForNextInterval(ctx context.Context) (IntervalStartBaselines, error) {
	query := `
	SELECT interval_end FROM timetracking_intervals ORDER BY interval_start DESC LIMIT 1
	`
	baselines := IntervalStartBaselines{
		AppStart: g.appStart,
		Manual:   g.currentBaseline,
	}

	rows, err := g.db.Query(query)
	if err != nil {
		return baselines, fmt.Errorf("Failed to get time tracking data: %w", err)
	}
	defer rows.Close()

	if rows.Next() {
		if err := rows.Scan(&baselines.LastintervalEnd); err != nil {
			return baselines, fmt.Errorf("scan timetracking_intervals row: %w", err)
		}
	}

	if err := rows.Err(); err != nil {
		return baselines, fmt.Errorf("rows iteration: %w", err)
	}

	return baselines, nil
}

func (g *TimeTrackingService) GetRecentActivities(ctx context.Context, daysBack int) ([]string, error) {
	query := `
	SELECT DISTINCT activity FROM timetracking_intervals WHERE interval_start > ?
	`

	rows, err := g.db.Query(query, time.Now().UTC().AddDate(0, 0, -daysBack))
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
	for _, category := range timetrackingConfig.Categories {
		for _, activity := range category.Activities {
			activityByCategory[activity] = category.Name
		}
	}

	return activityByCategory
}

func (g *TimeTrackingService) GetTimeTrackingDateStats(ctx context.Context, start time.Time, end time.Time) (*TimeTrackingStats, error) {
	query := `
	SELECT date(interval_start, 'localtime') AS interval_date, activity, SUM(activity_minutes) FROM timetracking_intervals
	WHERE interval_start >= ? AND interval_start < ?
	GROUP BY interval_date, activity
	ORDER BY interval_date ASC
	`

	rows, err := g.db.Query(query, start.UTC(), end.UTC())
	if err != nil {
		return nil, fmt.Errorf("Failed to get time tracking data: %w", err)
	}
	defer rows.Close()

	stats := make([]dbDateStats, 0)
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
		if len(stats) == 0 || stats[len(stats)-1].date != intervalDate {
			stats = append(stats, dbDateStats{
				date:       intervalDate,
				activities: make(map[string]map[string]int),
			})
		}
		category := categoryByActivity[activity]
		if category == "" {
			category = defaultCategory
		}
		// Add activity to the most recent DateStats
		activities := stats[len(stats)-1].activities[category]
		if activities == nil {
			activities = make(map[string]int)
			stats[len(stats)-1].activities[category] = activities
		}
		activities[activity] = activityMinutes
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return g.convertDbDateStatsArray(stats), nil
}

func (g *TimeTrackingService) convertDbDateStatsArray(statsArray []dbDateStats) *TimeTrackingStats {
	config := g.configService.Config().Timetracking

	output := TimeTrackingStats{
		TotalDurationMinutes: 0,
		Dates:                make([]DateStats, len(statsArray)),
		TotalsByCategory:     make([]Category, len(config.Categories)+1),
	}
	output.TotalsByCategory[0] = Category{Name: config.DefaultCategory}
	for idx, category := range config.Categories {
		output.TotalsByCategory[idx+1] = Category{Name: category.Name, Activities: make([]Activity, 0, 2)}
	}

	for dateIdx, stat := range statsArray {
		output.Dates[dateIdx] = convertDbDateStats(&stat, output.TotalsByCategory)
		output.TotalDurationMinutes += output.Dates[dateIdx].TotalDurationMinutes
	}

	for idx := range output.TotalsByCategory {
		slices.SortFunc(output.TotalsByCategory[idx].Activities, func(a Activity, b Activity) int {
			return cmp.Compare(a.Name, b.Name)
		})
	}

	return &output
}

func convertDbDateStats(stats *dbDateStats, totalsByCategory []Category) DateStats {
	output := DateStats{
		Date:                 stats.date,
		TotalDurationMinutes: 0,
		Categories:           make([]Category, len(stats.activities)),
	}

	categoryIdx := 0
	for i := range totalsByCategory {
		activities := stats.activities[totalsByCategory[i].Name]
		if activities != nil {
			output.Categories[categoryIdx] = convertDbCategory(&totalsByCategory[i], activities)
			output.TotalDurationMinutes += output.Categories[categoryIdx].TotalDurationMinutes
			totalsByCategory[i].TotalDurationMinutes += output.Categories[categoryIdx].TotalDurationMinutes
			categoryIdx++
		}
	}

	return output
}

func convertDbCategory(category *Category, activities map[string]int) Category {
	output := Category{
		Name:                 category.Name,
		TotalDurationMinutes: 0,
		Activities:           make([]Activity, len(activities)),
	}

	activityIdx := 0
	for activity, duration := range activities {
		output.Activities[activityIdx] = Activity{
			Name:            activity,
			DurationMinutes: duration,
		}
		output.TotalDurationMinutes += duration
		activityTotalIdx := slices.IndexFunc(category.Activities, func(e Activity) bool { return e.Name == activity })
		if activityTotalIdx < 0 {
			category.Activities = append(category.Activities, Activity{Name: activity, DurationMinutes: duration})
		} else {
			category.Activities[activityTotalIdx].DurationMinutes += duration
		}

		activityIdx++
	}

	slices.SortFunc(output.Activities, func(a Activity, b Activity) int {
		return cmp.Compare(a.Name, b.Name)
	})

	return output
}
