package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
	"uuid"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type TodoService struct {
	db  *sql.DB
	app *application.App
}

type Todo struct {
	ID          uuid.UUID `json:"id"`
	Description string    `json:"description"`
	DueAt       time.Time `json:"dueAt,omitzero"`
	CompletedAt time.Time `json:"completedAt,omitzero"`
	RemindMeAt  time.Time `json:"remindMeAt,omitzero"`
}

func (g *TodoService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	db, err := InitDB(ctx, "test.db")

	if err == nil {
		g.db = db
	}

	return err
}

func (g *TodoService) ServiceShutdown() error {
	if g.db != nil {
		return g.db.Close()
	}
	return nil
}

func (g *TodoService) AddTodo(ctx context.Context, todo Todo) error {
	g.app.Logger.Info(fmt.Sprintf("add todo: %+v", todo))
	return g.addOrUpdateTodo(ctx, todo, `INSERT INTO todos (data, id) VALUES (jsonb(?), ?)`)
}

func (g *TodoService) UpdateTodo(ctx context.Context, todo Todo) error {
	return g.addOrUpdateTodo(ctx, todo, `UPDATE todos SET data = jsonb(?) WHERE id = ?`)
}

func (g *TodoService) DeleteTodo(ctx context.Context, todo Todo) error {
	return g.DeleteTodoById(ctx, todo.ID.String())
}

func (g *TodoService) DeleteTodoById(ctx context.Context, todoId string) error {
	query := `DELETE FROM todos WHERE id = ?`

	_, err := g.db.ExecContext(ctx, query, todoId)
	if err != nil {
		return fmt.Errorf("insert/update todo: %w", err)
	}

	return nil
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

	return nil
}
