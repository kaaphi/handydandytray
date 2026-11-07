package todo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"handydandytray/internal/services"
	"log/slog"
	"time"
	"uuid"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type UINotifier interface {
	ShowNotification(notificationType string, props map[string]string)
	SetIconBadgeAlert(alert bool)
}

type TodoService struct {
	dbService  *services.DbService
	db         *sql.DB
	scheduler  *services.Scheduler
	logger     *slog.Logger
	notifier   UINotifier
	appContext context.Context

	alertState struct {
		hasPastDue    bool
		nextDue       *time.Time
		scheduleJobId uuid.UUID
	}
}

type TodoData struct {
	Description string    `json:"description"`
	DueAt       string    `json:"dueAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitzero"`
	RemindMeAt  time.Time `json:"remindMeAt,omitzero"`
}

type Todo struct {
	ID        uuid.UUID `json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	TodoData
}

const todo_job_tag = "todo"

func NewTodoService(db *services.DbService, scheduler *services.Scheduler, logger *slog.Logger, notifier UINotifier) *TodoService {
	service := TodoService{
		scheduler: scheduler,
		logger:    logger,
		dbService: db,
		notifier:  notifier,
	}

	service.alertState.scheduleJobId = uuid.New()

	return &service
}

func (g *TodoService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	if g.dbService.Db == nil {
		return errors.New("DB is not initialized!")
	}
	g.db = g.dbService.Db
	g.appContext = ctx

	go g.scheduleInitJobs()

	return nil
}

func (g *TodoService) scheduleInitJobs() {
	todos, err := g.GetActiveTodos(g.appContext)

	if err == nil {
		for _, todo := range todos {
			g.updateReminderJob(todo)
		}
	} else {
		g.logger.Error("Failed to load todos during init!", "error", err)
	}

	g.updateAlertState()
}

func (g *TodoService) AddTodo(ctx context.Context, todo TodoData) error {
	g.logger.Info(fmt.Sprintf("add todo: %+v", todo))
	return g.addOrUpdateTodo(ctx, Todo{
		ID:       uuid.NewV7(),
		TodoData: todo,
	}, `INSERT INTO todos (data, id) VALUES (jsonb(?), ?)`)
}

func (g *TodoService) UpdateTodo(ctx context.Context, todo Todo) error {
	return g.addOrUpdateTodo(ctx, todo, `UPDATE todos SET data = jsonb(?) WHERE id = ?`)
}

func (g *TodoService) DeleteTodo(ctx context.Context, todo Todo) error {
	return g.DeleteTodoById(ctx, todo.ID)
}

func (g *TodoService) DeleteTodoById(ctx context.Context, todoId uuid.UUID) error {
	query := `DELETE FROM todos WHERE id = ?`

	_, err := g.db.ExecContext(ctx, query, todoId)
	if err != nil {
		return fmt.Errorf("delete todo: %w", err)
	}

	g.removeReminderJob(todoId)
	g.updateAlertState()

	return nil
}

func (g *TodoService) DeleteAll(ctx context.Context) error {
	query := `DELETE FROM todos`

	_, err := g.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("delete todos: %w", err)
	}

	g.scheduler.RemoveAll(todo_job_tag)

	return nil
}

func (g *TodoService) GetTodo(ctx context.Context, id uuid.UUID) (*Todo, error) {
	result, err := g.getTodosQuery(ctx, `WHERE id = ?`, id)

	if err != nil {
		return nil, err
	}

	if len(result) < 1 {
		return nil, fmt.Errorf("Todo with id %s not found!", id)
	}

	return &result[0], nil
}

func (g *TodoService) GetAllTodos(ctx context.Context) ([]Todo, error) {
	return g.getTodosQuery(ctx, `ORDER BY id DESC`)
}

func (g *TodoService) GetActiveTodos(ctx context.Context) ([]Todo, error) {
	return g.getTodosQuery(ctx, `WHERE data->>'$.completedAt' IS NULL ORDER BY id DESC`)
}

func (g *TodoService) GetCompletedTodos(ctx context.Context) ([]Todo, error) {
	return g.getTodosQuery(ctx, `WHERE data->>'$.completedAt' IS NOT NULL ORDER BY data->>'$.completedAt' DESC`)
}

// Returns the next due alert (or nil if no alerts are due in the future) and reports whether any alerts are past due.
func (g *TodoService) getNextDueAlert(ctx context.Context) (*time.Time, bool, error) {
	todos, err := g.GetActiveTodos(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("failed to query todos: %w", err)
	}

	now := time.Now()
	hasPastDue := false
	var result time.Time

	updateResult := func(dueTime time.Time) {
		if dueTime.Before(now) || dueTime.Equal(now) {
			hasPastDue = true
		} else if result.IsZero() || dueTime.Before(result) {
			result = dueTime
		}
	}

	for _, todo := range todos {
		if !todo.RemindMeAt.IsZero() {
			updateResult(todo.RemindMeAt)
		}

		if todo.DueAt != "" {
			dueTime, err := time.Parse("2006-01-02", todo.DueAt)
			if err != nil {
				return nil, false, err
			}
			updateResult(dueTime)
		}
	}

	if result.IsZero() {
		return nil, hasPastDue, nil
	} else {
		return &result, hasPastDue, nil
	}
}

func (g *TodoService) updateAlertState() {
	nextAlert, hasPastDue, err := g.getNextDueAlert(g.appContext)
	g.logger.Info("next alert due", "nextAlert", nextAlert, "hasPastDue", hasPastDue, "err", err)

	if err != nil {
		g.logger.Error("Failed to get next due alert!", "error", err)
	}

	g.notifier.SetIconBadgeAlert(hasPastDue)

	if nextAlert == nil {
		err = g.scheduler.RemoveJob(g.alertState.scheduleJobId)
	} else if g.alertState.nextDue == nil || (g.alertState.nextDue != nil && nextAlert.Before(*g.alertState.nextDue)) {
		err = g.scheduler.ScheduleOneShot(g.alertState.scheduleJobId, "todo", *nextAlert, func() {
			g.updateAlertState()
		})
	}
	if err != nil {
		g.logger.Error("Failed to schedule next due alert!", "nextAlert", *nextAlert, "error", err)
		return
	}

	g.alertState.nextDue = nextAlert
	g.alertState.hasPastDue = hasPastDue
}

func (g *TodoService) getTodosQuery(ctx context.Context, afterFromClauses string, args ...any) ([]Todo, error) {
	query := "SELECT id, json(data), created_at FROM todos " + afterFromClauses

	rows, err := g.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query todos: %w", err)
	}
	defer rows.Close()

	todos := make([]Todo, 0)

	for rows.Next() {
		var rawData []byte
		var createdAt time.Time
		var id uuid.UUID
		if err := rows.Scan(&id, &rawData, &createdAt); err != nil {
			return nil, fmt.Errorf("scan todo row: %w", err)
		}

		var item Todo
		if err := json.Unmarshal(rawData, &item); err != nil {
			return nil, fmt.Errorf("unmarshal todo: %w", err)
		}
		item.ID = id
		item.CreatedAt = createdAt

		todos = append(todos, item)
	}

	// Catch any iteration errors
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return todos, nil
}

func (g *TodoService) addOrUpdateTodo(ctx context.Context, todo Todo, query string) error {

	payload, err := json.Marshal(todo.TodoData)
	if err != nil {
		return fmt.Errorf("marshal todo: %w", err)
	}
	_, err = g.db.ExecContext(ctx, query, payload, todo.ID)
	if err != nil {
		return fmt.Errorf("insert/update todo: %w", err)
	}

	g.updateReminderJob(todo)
	g.updateAlertState()

	return nil
}

func (g *TodoService) removeReminderJob(todoId uuid.UUID) {
	err := g.scheduler.RemoveJob(todoId)
	if err != nil {
		g.logger.Error("Failed to remove Todo reminder!", "todoId", todoId, "error", err)
	}
}

func (g *TodoService) updateReminderJob(todo Todo) {
	g.doRescheduleOrDeleteReminderJob(todo, false)
}

func (g *TodoService) doRescheduleOrDeleteReminderJob(todo Todo, isDelete bool) {
	if todo.RemindMeAt.IsZero() || isDelete || !todo.CompletedAt.IsZero() {
		g.removeReminderJob(todo.ID)
	} else if todo.RemindMeAt.After(time.Now()) {
		g.ScheduleReminderJob(todo.ID, todo, todo.RemindMeAt)
	} else {
		g.logger.Warn("Will not schedule reminder because it is in the past.", "todo", todo)
	}
}

func (g *TodoService) ScheduleReminderJob(id uuid.UUID, todo Todo, at time.Time) {
	err := g.scheduler.ScheduleOneShot(id, todo_job_tag, at, func(todo Todo) {
		g.logger.Info("Triggering reminder for todo", "todo", todo)
		g.ShowTodoReminder(todo)
	}, todo)
	if err != nil {
		g.logger.Error("Failed to schedule Todo reminder!", "todo", todo, "error", err)
	}
}

func (g *TodoService) ShowTodoReminder(todo Todo) {
	g.notifier.ShowNotification("todo", map[string]string{
		"todoId": todo.ID.String(),
	})
}
