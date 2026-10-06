package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"
	"uuid"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type TodoService struct {
	dbService *DbService
	db        *sql.DB
	scheduler *Scheduler
	logger    *slog.Logger
	notifier  UINotifier
}

type Todo struct {
	ID          uuid.UUID `json:"id"`
	Description string    `json:"description"`
	DueAt       string    `json:"dueAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitzero"`
	RemindMeAt  time.Time `json:"remindMeAt,omitzero"`
}

type UINotifier interface {
	ShowTodoReminder(todo Todo)
}

const todo_job_tag = "todo"

func NewTodoService(db *DbService, scheduler *Scheduler, logger *slog.Logger, notifier UINotifier) *TodoService {
	return &TodoService{
		scheduler: scheduler,
		logger:    logger,
		dbService: db,
		notifier:  notifier,
	}
}

func (g *TodoService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	if g.dbService.Db == nil {
		return errors.New("DB is not initialized!")
	}
	g.db = g.dbService.Db

	todos, err := g.GetActiveTodos(ctx)

	if err == nil {
		for _, todo := range todos {
			g.updateReminderJob(ctx, todo)
		}
	} else {
		g.logger.Error("Failed to load todos during init!", "error", err)
	}

	return nil
}

func (g *TodoService) AddTodo(ctx context.Context, todo Todo) error {
	g.logger.Info(fmt.Sprintf("add todo: %+v", todo))
	return g.addOrUpdateTodo(ctx, todo, `INSERT INTO todos (data, id) VALUES (jsonb(?), ?)`)
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

	g.removeReminderJob(ctx, todoId)

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
	result, err := g.getTodosQuery(ctx, `SELECT json(data) FROM todos WHERE id = ?`, id)

	if len(result) < 1 {
		return nil, fmt.Errorf("Todo with id %s not found!", id)
	}

	if err != nil {
		return nil, err
	}

	return &result[0], nil
}

func (g *TodoService) GetAllTodos(ctx context.Context) ([]Todo, error) {
	return g.getTodosQuery(ctx, `SELECT json(data) FROM todos ORDER BY id ASC`)
}

func (g *TodoService) GetActiveTodos(ctx context.Context) ([]Todo, error) {
	return g.getTodosQuery(ctx, `SELECT json(data) FROM todos WHERE data->>'$.completedAt' IS NULL ORDER BY id ASC`)
}

func (g *TodoService) GetCompletedTodos(ctx context.Context) ([]Todo, error) {
	return g.getTodosQuery(ctx, `SELECT json(data) FROM todos WHERE data->>'$.completedAt' IS NOT NULL ORDER BY data->>'$.completedAt' DESC`)
}

func (g *TodoService) getTodosQuery(ctx context.Context, query string, args ...any) ([]Todo, error) {

	rows, err := g.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query todos: %w", err)
	}
	defer rows.Close()

	todos := make([]Todo, 0)

	for rows.Next() {
		var rawData []byte
		if err := rows.Scan(&rawData); err != nil {
			return nil, fmt.Errorf("scan todo row: %w", err)
		}

		var item Todo
		if err := json.Unmarshal(rawData, &item); err != nil {
			return nil, fmt.Errorf("unmarshal todo: %w", err)
		}

		todos = append(todos, item)
	}

	// Catch any iteration errors
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return todos, nil
}

func (g *TodoService) addOrUpdateTodo(ctx context.Context, todo Todo, query string) error {

	payload, err := json.Marshal(todo)
	if err != nil {
		return fmt.Errorf("marshal todo: %w", err)
	}
	_, err = g.db.ExecContext(ctx, query, payload, todo.ID)
	if err != nil {
		return fmt.Errorf("insert/update todo: %w", err)
	}

	g.updateReminderJob(ctx, todo)

	return nil
}

func (g *TodoService) removeReminderJob(ctx context.Context, todoId uuid.UUID) {
	err := g.scheduler.RemoveJob(todoId)
	if err != nil {
		g.logger.Error("Failed to remove Todo reminder!", todoId, "error", err)
	}
}

func (g *TodoService) updateReminderJob(ctx context.Context, todo Todo) {
	g.doRescheduleOrDeleteReminderJob(ctx, todo, false)
}

func (g *TodoService) doRescheduleOrDeleteReminderJob(ctx context.Context, todo Todo, isDelete bool) {
	if todo.RemindMeAt.IsZero() || isDelete {
		g.removeReminderJob(ctx, todo.ID)
	} else if todo.RemindMeAt.After(time.Now()) {
		err := g.scheduler.ScheduleOneShot(todo.ID, todo_job_tag, todo.RemindMeAt, func(todo Todo) {
			g.logger.Info("Triggering reminder for todo", "todo", todo)
			g.notifier.ShowTodoReminder(todo)
		}, todo)
		if err != nil {
			g.logger.Error("Failed to schedule Todo reminder!", todo, "error", err)
		}
	} else {
		g.logger.Warn("Will not schedule reminder because it is in the past.", "todo", todo)
	}
}
