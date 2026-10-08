package main

import (
	"embed"
	"math/rand"
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
	application.RegisterEvent[string]("time")
}

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {

	// Create a new Wails application by providing the necessary options.
	// Variables 'Name' and 'Description' are for application metadata.
	// 'Assets' configures the asset server with the 'FS' variable pointing to the frontend files.
	// 'Bind' is a list of Go struct instances. The frontend has access to the methods of these instances.
	// 'Mac' options tailor the application when running an macOS.
	app := application.New(application.Options{
		Name:        "handydandytray",
		Description: "A demo of using raw HTML & CSS",
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},

		// Mac: application.MacOptions{
		// 	ApplicationShouldTerminateAfterLastWindowClosed: true,
		// },
	})

	scheduler, err := NewScheduler()
	if err != nil {
		log.Fatal(err)
	}

	app.OnShutdown(func() {
		err := scheduler.Shutdown()

		if err != nil {
			app.Logger.Error("Failed to shutdown scheduler", "error", err)
		}
	})

	dbService := &DbService{}
	uiService := NewUIService(app)
	todoService := NewTodoService(dbService, scheduler, app.Logger, uiService)

	app.RegisterService(
		application.NewService(dbService),
	)

	app.RegisterService(
		application.NewService(uiService),
	)

	app.RegisterService(
		application.NewService(todoService),
	)

	systray := app.SystemTray.New()

	menu := app.NewMenu()
	menu.Add("Todos...").OnClick(func(ctx *application.Context) {
		uiService.OpenTodosWindow()
	})
	appendDevMenu(app, menu, todoService)
	menu.Add("Quit").OnClick(func(ctx *application.Context) {
		app.Quit()
	})
	systray.SetMenu(menu)

	// Create a new window with the necessary options.
	// 'Title' is the title of the window.
	// 'Mac' options tailor the window when running on macOS.
	// 'BackgroundColour' is the background colour of the window.
	// 'URL' is the URL that will be loaded into the webview.
	// app.Window.NewWithOptions(application.WebviewWindowOptions{
	// 	Title: "Window 1",
	// 	// Window sized to the golden ratio (1000 / 618 ≈ 1.618).
	// 	Width:  1000,
	// 	Height: 618,
	// 	Mac: application.MacWindow{
	// 		InvisibleTitleBarHeight: 50,
	// 		Backdrop:                application.MacBackdropTranslucent,
	// 		TitleBar:                application.MacTitleBarHiddenInset,
	// 	},
	// 	BackgroundColour: application.NewRGB(6, 7, 15),
	// 	URL:              "/",
	// })

	// Run the application. This blocks until the application has been exited.
	err = app.Run()

	// If an error occurred while running the application, log it and exit.
	if err != nil {
		log.Fatal(err)
	}
}

func appendDevMenu(app *application.App, menu *application.Menu, todoService *TodoService) {
	if !app.Env.Info().Debug {
		return
	}

	app.Logger.Info("DEV MODE")
	menu.Add("Trigger Random Reminder").OnClick(func(ctx *application.Context) {
		todos, err := todoService.GetActiveTodos(app.Context())

		if err != nil {
			app.Logger.Error("Failed to get TODOs to trigger dev reminder", "error", err)
			return
		}

		if len(todos) > 0 {
			randomIndex := rand.Intn(len(todos))

			todoService.scheduleReminderJob(uuid.NewV7(), todos[randomIndex], time.Now().Add(5*time.Second))
		} else {
			app.Logger.Info("No active todos to trigger reminder for")
		}
	})
}
