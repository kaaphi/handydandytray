package ui

import (
	"context"
	"handydandytray/internal/assets"
	"handydandytray/internal/services"
	"image/color"
	"time"
	"uuid"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
	"github.com/wailsapp/wails/v3/pkg/services/dock"
)

type TodoReminderSizeDefaults = int

const (
	reminder_default_width  TodoReminderSizeDefaults = 400
	reminder_default_height TodoReminderSizeDefaults = 150
	enter_time_min_width                             = 740
	enter_time_min_height                            = 340
)

type UIService struct {
	app           *application.App
	scheduler     *services.Scheduler
	dockService   *dock.DockService
	systray       *application.SystemTray
	hasAlertBadge bool
}

func NewUIService(app *application.App, scheduler *services.Scheduler) *UIService {
	dockService := dock.NewWithOptions(dock.BadgeOptions{
		BackgroundColour: color.RGBA{222, 217, 226, 255}, // Same background as systray alert icon
		TextColour:       color.RGBA{0, 0, 0, 255},       // Black text
		FontSize:         14,
		SmallFontSize:    10,
	})
	app.RegisterService(application.NewService(dockService))
	service := &UIService{app: app, scheduler: scheduler, dockService: dockService}
	service.createMainWindow()
	service.createEnterTimeWindow()
	service.createNotificationWindow()
	service.createSysTray()
	return service
}

func (g *UIService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return g.scheduler.ScheduleRepeated(uuid.New(), "entertime", "0 * * * *", func() {
		g.app.Logger.Info("Triggering hourly enter time notification.")
		g.ShowNotification("enterTime", map[string]string{})
	})
}

func (g *UIService) createMainWindow() {
	todosWin := g.app.Window.NewWithOptions(application.WebviewWindowOptions{
		Name:   "main",
		Title:  "Handy Dandy Tray",
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

func (g *UIService) createSysTray() {
	g.systray = g.app.SystemTray.New()
	g.systray.SetIcon(assets.SysTrayIcon)
	g.systray.SetLabel("Handy Dandy Tray")

	g.systray.OnClick(func() {
		g.OpenMainWindow()
	})
}

func (g *UIService) SetIconBadgeAlert(isAlert bool) {
	g.app.Logger.Info("SetIconBadgeAlert", "hasAlertBadge", g.hasAlertBadge, "isAlert", isAlert)
	if isAlert == g.hasAlertBadge {
		return
	}
	g.hasAlertBadge = isAlert

	var note string = ""
	var icon *[]byte

	if isAlert {
		note = " (needs attention)"
		icon = &assets.SysTrayIconAlert
	} else {
		icon = &assets.SysTrayIcon
	}

	g.systray.SetIcon(*icon)
	g.systray.SetLabel("Handy Dandy Tray" + note)
	g.systray.SetTooltip("Handy Dandy Tray" + note)
	g.updateDockBadge()
}

func (g *UIService) updateDockBadge() {
	if g.hasAlertBadge {
		if err := g.dockService.SetBadge("!"); err != nil {
			g.app.Logger.Error("Failed to set dock badge!", "error", err)
		}
	} else {
		if err := g.dockService.RemoveBadge(); err != nil {
			g.app.Logger.Error("Failed to remove dock badge!", "error", err)
		}
	}
}

func (g *UIService) SetSysTrayMenu(menu *application.Menu) {
	g.systray.SetMenu(menu)
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

func (g *UIService) OpenMainWindow() {
	// Focus existing instance if already open
	if todosWin, ok := g.app.Window.GetByName("main"); ok {
		wasVisible := todosWin.IsVisible()
		todosWin.Show()
		todosWin.Focus()
		if !wasVisible {
			g.updateDockBadge()
		}
		return
	}
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
		g.app.Logger.Info("Triggering snoozed enter time notification.")
		g.ShowNotification("enterTime", map[string]string{})
	})

	if err != nil {
		g.app.Logger.Error("Failed to snooze enter time!", "error", err)
	}
}
