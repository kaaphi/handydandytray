package todo

import (
	"errors"
	"handydandytray/internal/services"
	"log/slog"
	"os"
	"testing"
	"time"
	"uuid"

	"github.com/alecthomas/assert/v2"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type MockUINotifier struct {
}

func (g *MockUINotifier) ShowNotification(notificationType string, props map[string]string) {

}

func (g *MockUINotifier) SetIconBadgeAlert(alert bool) {

}

const testDbPath = "test_todos.db"

type TestTodoInserter struct {
	t                  *testing.T
	todoService        *TodoService
	AllInsertedUuids   []uuid.UUID
	InsertedUuidGroups map[string][]uuid.UUID
}

func insertTodos(t *testing.T, todoService *TodoService) *TestTodoInserter {
	return &TestTodoInserter{
		t:                  t,
		todoService:        todoService,
		AllInsertedUuids:   make([]uuid.UUID, 0),
		InsertedUuidGroups: map[string][]uuid.UUID{},
	}
}

func (g *TestTodoInserter) result() ([]uuid.UUID, map[string][]uuid.UUID) {
	return g.AllInsertedUuids, g.InsertedUuidGroups
}

func (g *TestTodoInserter) add(data TodoData, groups ...string) *TestTodoInserter {
	id, err := g.todoService.AddTodo(g.t.Context(), data)
	assert.NoError(g.t, err)

	g.AllInsertedUuids = append(g.AllInsertedUuids, id)
	for _, groupName := range groups {
		group, ok := g.InsertedUuidGroups[groupName]
		if !ok {
			g.InsertedUuidGroups[groupName] = make([]uuid.UUID, 0, 4)
		}
		g.InsertedUuidGroups[groupName] = append(group, id)
	}

	return g
}

func uuidsToString(ids []uuid.UUID) []string {
	out := make([]string, len(ids))
	for i, id := range ids {
		out[i] = id.String()
	}
	return out
}

func TestDatabaseGroup(t *testing.T) {
	_, err := os.Stat(testDbPath)
	if !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("%s db file already exists or there was another error reading it: %v", testDbPath, err)
	}

	scheduler, err := services.NewScheduler()
	assert.NoError(t, err)
	dbService := services.NewDbService(slog.Default(), testDbPath)
	service := NewTodoService(dbService, scheduler, slog.Default(), &MockUINotifier{})
	dbService.ServiceStartup(t.Context(), application.DefaultServiceOptions)
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
		assert.NoError(t, service.DeleteAll(t.Context()))
	}

	t.Run("Add Todo", func(t *testing.T) {
		defer teardown(t)

		data := TodoData{
			Description: "My Todo",
		}

		id, err := service.AddTodo(t.Context(), data)
		assert.NoError(t, err)

		actual, err := service.GetTodo(t.Context(), id)
		assert.NoError(t, err)

		assert.Equal(t, data, actual.TodoData)
	})

	t.Run("Delete completed", func(t *testing.T) {
		defer teardown(t)

		completedAtCutoff := time.Now().Add(-24 * time.Hour)

		insertedIds, groups := insertTodos(t, service).
			add(TodoData{CompletedAt: completedAtCutoff.Add(-1 * time.Hour)}).
			add(TodoData{CompletedAt: completedAtCutoff.Add(-2 * time.Hour)}).
			add(TodoData{CompletedAt: completedAtCutoff.Add(1 * time.Hour)}, "keep").
			add(TodoData{}, "keep").
			add(TodoData{CompletedAt: completedAtCutoff.Add(2 * time.Hour)}, "keep").
			add(TodoData{CompletedAt: completedAtCutoff.Add(-1 * time.Hour)}).
			add(TodoData{}, "keep").
			add(TodoData{CompletedAt: completedAtCutoff.Add(-1 * time.Hour)}).
			add(TodoData{}, "keep").
			add(TodoData{CompletedAt: completedAtCutoff.Add(-1 * time.Hour)}).
			add(TodoData{CompletedAt: completedAtCutoff.Add(2 * time.Hour)}, "keep").
			add(TodoData{CompletedAt: completedAtCutoff.Add(-1 * time.Hour)}).
			add(TodoData{}, "keep").
			result()

		actualIds, err := service.getTodoIdsQuery(t.Context())
		assert.NoError(t, err)

		assert.Equal(t, insertedIds, actualIds)

		assert.NoError(t, service.DeleteCompletedBefore(t.Context(), completedAtCutoff))

		actualIdsAfterDelete, err := service.getTodoIdsQuery(t.Context())
		assert.NoError(t, err)

		assert.Equal(t, uuidsToString(groups["keep"]), uuidsToString(actualIdsAfterDelete))
	})

}
