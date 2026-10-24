package ui

import (
	"context"
	"handydandytray/internal/services"
	"time"
	"uuid"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

type TodoReminderSizeDefaults = int

const (
	reminder_default_width  TodoReminderSizeDefaults = 400
	reminder_default_height TodoReminderSizeDefaults = 150
	enter_time_min_width                             = 740
	enter_time_min_height                            = 340
)

type UIService struct {
	app       *application.App
	scheduler *services.Scheduler
}

func NewUIService(app *application.App, scheduler *services.Scheduler) *UIService {
	service := &UIService{app: app, scheduler: scheduler}
	service.createTodoWindow()
	service.createTodoReminderWindow()
	service.createEnterTimeWindow()
	service.createNotificationWindow()
	return service
}

func (g *UIService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return g.scheduler.ScheduleRepeated(uuid.New(), "entertime", "0 * * * *", func() {
		g.ShowNotification("enterTime", map[string]string{})
	})
}

func (g *UIService) createTodoWindow() {
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
	enterTimeWin := g.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:        "entertime",
		Title:       "Enter Time",
		Width:       enter_time_min_width,
		Height:      enter_time_min_height,
		MinWidth:    enter_time_min_width,
		MinHeight:   enter_time_min_height,
		URL:         "/#/enterTime",
		AlwaysOnTop: true,
		Hidden:      true,
	})

	// This also prevents the application from exiting
	enterTimeWin.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()          // Stop Wails from destroying the window
		enterTimeWin.Hide() // Simply hide it from view
	})
}

func (g *UIService) createTodoReminderWindow() {
	reminderWin := g.app.Window.NewWithOptions(application.WebviewWindowOptions{
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
	reminderWin.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()         // Stop Wails from destroying the window
		reminderWin.Hide() // Simply hide it from view
	})
}

func (g *UIService) createNotificationWindow() {
	reminderWin := g.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:           "notifications",
		Title:          "HandyDandyTray Reminder",
		Width:          reminder_default_width,
		Height:         reminder_default_height,
		URL:            "/#/notifications",
		Frameless:      true,
		Hidden:         true,
		AlwaysOnTop:    true,
		BackgroundType: application.BackgroundTypeTransparent,
		Windows: application.WindowsWindow{
			HiddenOnTaskbar:                   true,
			DisableFramelessWindowDecorations: true,
		},
	})

	// This also prevents the application from exiting
	reminderWin.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
		e.Cancel()         // Stop Wails from destroying the window
		reminderWin.Hide() // Simply hide it from view
	})
}

func (g *UIService) OpenEnterTimeWindow() {
	if todosWin, ok := g.app.Window.GetByName("entertime"); ok {
		g.app.Event.Emit("timetracking:enterTime")
		todosWin.SetSize(enter_time_min_width, enter_time_min_height)
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

func (g *UIService) ShowNotificationsWindow() {
	if notifications, ok := g.app.Window.GetByName("notifications"); ok {
		screen := g.app.Screen.GetPrimary()
		x := screen.WorkArea.X + screen.WorkArea.Width - notifications.Width()
		y := screen.WorkArea.Y + screen.WorkArea.Height - notifications.Height()

		notifications.SetPosition(x, y)
		notifications.Show()
		return
	}

	g.app.Logger.Error("No notifications window to display!")
}

func (g *UIService) HideTodoReminder() {
	if todoReminder, ok := g.app.Window.GetByName("todoReminder"); ok {
		todoReminder.Hide()
	}
}

func (g *UIService) HideNotifications() {
	if todoReminder, ok := g.app.Window.GetByName("notifications"); ok {
		todoReminder.Hide()
	}
}

func (g *UIService) EmitEvent(eventName string, data ...any) {
	g.app.Event.Emit(eventName, data...)
}

func (g *UIService) ShowNotification(notificationType string, props map[string]string) {
	g.app.Event.Emit("notification:showNotification", map[string]interface{}{
		"type":  notificationType,
		"props": props,
	})
}

func (g *UIService) SnoozeEnterTime() {
	err := g.scheduler.ScheduleOneShot(uuid.New(), "entertime", time.Now().Add(5*time.Minute), func() {
		g.ShowNotification("enterTime", map[string]string{})
	})

	if err != nil {
		g.app.Logger.Error("Failed to snooze enter time!", "error", err)
	}
}
