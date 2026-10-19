package ui

import (
	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type TodoReminderSizeDefaults = int

const (
	reminder_default_width  TodoReminderSizeDefaults = 400
	reminder_default_height TodoReminderSizeDefaults = 150
)

type UIService struct {
	app *application.App
}

func NewUIService(app *application.App) *UIService {
	service := &UIService{app: app}
	service.createTodoWindow()
	service.createTodoReminderWindow()
	service.createEnterTimeWindow()
	return service
}

func (g *UIService) createTodoWindow() {
	// Create new window pointing to the /todos route
	todosWin := g.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:   "todos",
		Title:  "Todos",
		Width:  600,
		Height: 600,
		URL:    "/#/todos",
		Hidden: true,
	})

	// This also prevents the application from exiting
	todosWin.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()      // Stop Wails from destroying the window
		todosWin.Hide() // Simply hide it from view
	})
}

func (g *UIService) createEnterTimeWindow() {
	// Create new window pointing to the /todos route
	todosWin := g.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:        "entertime",
		Title:       "Enter Time",
		Width:       600,
		Height:      600,
		URL:         "/#/enterTime",
		AlwaysOnTop: true,
		Hidden:      true,
	})

	// This also prevents the application from exiting
	todosWin.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()      // Stop Wails from destroying the window
		todosWin.Hide() // Simply hide it from view
	})
}

func (g *UIService) createTodoReminderWindow() {
	// Create new window pointing to the /todos route
	todosWin := g.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:        "todoReminder",
		Title:       "HandyDandyTray Reminder",
		Width:       reminder_default_width,
		Height:      reminder_default_height,
		URL:         "/#/todoReminder",
		Frameless:   true,
		Hidden:      true,
		AlwaysOnTop: true,
		Windows: application.WindowsWindow{
			HiddenOnTaskbar: true,
		},
	})

	// This also prevents the application from exiting
	todosWin.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()      // Stop Wails from destroying the window
		todosWin.Hide() // Simply hide it from view
	})
}

func (g *UIService) OpenEnterTimeWindow() {
	if todosWin, ok := g.app.Window.GetByName("entertime"); ok {
		g.app.Event.Emit("timetracking:enterTime")
		todosWin.Show()
		todosWin.Focus()
		return
	}
}

func (g *UIService) HideEnterTimeWindow() {
	if todoReminder, ok := g.app.Window.GetByName("entertime"); ok {
		todoReminder.Hide()
	}
}

func (g *UIService) OpenTodosWindow() {
	// Focus existing instance if already open
	if todosWin, ok := g.app.Window.GetByName("todos"); ok {
		todosWin.Show()
		todosWin.Focus()
		return
	}
}

func (g *UIService) ShowTodoReminderWindow() {
	if todoReminder, ok := g.app.Window.GetByName("todoReminder"); ok {
		screen := g.app.Screen.GetPrimary()
		x := screen.WorkArea.X + screen.WorkArea.Width - todoReminder.Width()
		y := screen.WorkArea.Y + screen.WorkArea.Height - todoReminder.Height()

		todoReminder.SetPosition(x, y)
		todoReminder.Show()
		return
	}

	g.app.Logger.Error("No todo reminder window to display!")
}

func (g *UIService) HideTodoReminder() {
	if todoReminder, ok := g.app.Window.GetByName("todoReminder"); ok {
		todoReminder.Hide()
	}
}

func (g *UIService) EmitEvent(eventName string, data ...any) {
	g.app.Event.Emit(eventName, data...)
}
