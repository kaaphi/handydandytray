package main

import (
	"embed"
	"handydandytray/internal/services"
	"handydandytray/internal/timetracking"
	"handydandytray/internal/todo"
	"handydandytray/internal/ui"
	"log/slog"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"log"
	"uuid"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

func init() {
	// Register a custom event whose associated data type is string.
	// This is not required, but the binding generator will pick up registered events
	// and provide a strongly typed JS/TS API for them.
	application.RegisterEvent[string]("todo:reminder")
	application.RegisterEvent[string]("todo:reminderClicked")
}

func main() {
	logLevel := new(slog.LevelVar)
	logLevel.Set(slog.LevelInfo)
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	app := application.New(application.Options{
		Name:        "handydandytray",
		Description: "Handy Dandy Tray",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Logger: logger,
	})

	scheduler, err := services.NewScheduler()
	if err != nil {
		log.Fatal(err)
	}

	app.OnShutdown(func() {
		err := scheduler.Shutdown()

		if err != nil {
			app.Logger.Error("Failed to shutdown scheduler", "error", err)
		}
	})

	configService := services.NewConfigService(getPath(app, "config.toml", "test_config.toml"), app.Logger)
	dbService := services.NewDbService(app.Logger, getDbPath(app))
	uiService := ui.NewUIService(app, scheduler)
	todoService := todo.NewTodoService(dbService, scheduler, app.Logger, uiService)
	timeTrackingService := timetracking.NewTimeTrackingService(app.Logger, dbService, configService)

	app.RegisterService(
		application.NewService(configService),
	)

	app.RegisterService(
		application.NewService(dbService),
	)

	app.RegisterService(
		application.NewService(uiService),
	)

	app.RegisterService(
		application.NewService(todoService),
	)

	app.RegisterService(
		application.NewService(timeTrackingService),
	)

	menu := app.NewMenu()
	appendDevMenu(app, menu, todoService, uiService, logLevel)
	menu.Add("Enter time now").OnClick(func(ctx *application.Context) {
		uiService.OpenEnterTimeWindow()
	})
	menu.Add("Reset next interval start").OnClick(func(ctx *application.Context) {
		timeTrackingService.UpdateDefaultBaselineForNextInterval(app.Context(), time.Now())
		app.Event.Emit("timetracking:baselineUpdated")
	})

	menu.Add("Quit Handy Dandy Tray").OnClick(func(ctx *application.Context) {
		app.Quit()
	})
	uiService.SetSysTrayMenu(menu)

	// Run the application. This blocks until the application has been exited.
	err = app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}

func getDbPath(app *application.App) string {
	return getPath(app, "handydandy.db", "test.db")
}

func getPath(app *application.App, prodPath string, devPath string) string {
	if app.Env.Info().Debug {
		return devPath
	} else {
		// Get the absolute path of the executable
		ex, err := os.Executable()
		if err != nil {
			panic(err)
		}

		exDir := filepath.Dir(ex)

		return filepath.Join(exDir, prodPath)
	}
}

func appendDevMenu(app *application.App, menu *application.Menu, todoService *todo.TodoService, uiService *ui.UIService, logLevel *slog.LevelVar) {
	if !app.Env.Info().Debug {
		return
	}

	app.Logger.Info("DEV MODE")
	menu.AddCheckbox("Debug Logs", false).OnClick(func(ctx *application.Context) {
		if ctx.ClickedMenuItem().Checked() {
			logLevel.Set(slog.LevelDebug)
		} else {
			logLevel.Set(slog.LevelInfo)
		}
	})
	menu.Add("Trigger Random Reminder").OnClick(func(ctx *application.Context) {
		todos, err := todoService.GetActiveTodos(app.Context())

		if err != nil {
			app.Logger.Error("Failed to get TODOs to trigger dev reminder", "error", err)
			return
		}

		if len(todos) > 0 {
			randomIndex := rand.Intn(len(todos))

			todoService.ScheduleReminderJob(uuid.NewV7(), todos[randomIndex], time.Now().Add(5*time.Second))
		} else {
			app.Logger.Info("No active todos to trigger reminder for")
		}
	})
}
