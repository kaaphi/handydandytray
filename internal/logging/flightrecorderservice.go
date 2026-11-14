package logging

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

type FlightRecorderService struct {
	buffer    *RingBuffer
	outputDir string
	logLevel  *slog.LevelVar
}

func NewFlightRecorderService(capacity int) *FlightRecorderService {
	return &FlightRecorderService{
		buffer:   NewRingBuffer(capacity),
		logLevel: new(slog.LevelVar),
	}
}

func (g *FlightRecorderService) CreateLogger() *slog.Logger {
	consoleHandler := slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: g.logLevel,
	})
	memoryHandler := slog.NewTextHandler(g.buffer, &slog.HandlerOptions{
		Level: g.logLevel,
	})

	return slog.New(slog.NewMultiHandler(consoleHandler, memoryHandler))
}

func (g *FlightRecorderService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	g.SetLogLevel(slog.LevelInfo)

	app := application.Get()

	if app != nil && !app.Env.Info().Debug {
		ex, err := os.Executable()
		if err != nil {
			return err
		}
		g.outputDir = filepath.Dir(ex)
	}

	return nil
}

func (g *FlightRecorderService) SetLogLevel(level slog.Level) {
	g.logLevel.Set(level)
}

func (g *FlightRecorderService) Dump() (string, error) {
	output, err := filepath.Abs(filepath.Join(g.outputDir, "dump_"+time.Now().Format("20060102T150405")+".log"))
	if err != nil {
		return "", err
	}
	return output, g.buffer.DumpToFile(output)
}
