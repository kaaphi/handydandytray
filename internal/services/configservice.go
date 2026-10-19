package services

import (
	"context"
	"errors"
	"log/slog"
	"os"

	"github.com/pelletier/go-toml/v2"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type ConfigService struct {
	configPath string
	logger     *slog.Logger
	Config     *Config
}

type TimeTrackingConfig struct {
	DefaultCategory    string
	CategoryActivities map[string][]string
}

type Config struct {
	Timetracking TimeTrackingConfig
}

func NewConfigService(configPath string, logger *slog.Logger) *ConfigService {
	return &ConfigService{
		configPath: configPath,
		logger:     logger,
	}
}

func (g *ConfigService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return g.Reload()
}

func (g *ConfigService) Reload() error {
	var config Config = Config{
		Timetracking: TimeTrackingConfig{
			DefaultCategory:    "default",
			CategoryActivities: map[string][]string{},
		},
	}

	content, err := os.ReadFile(g.configPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			g.logger.Warn("Config file does not exist, using defaul config", "configPath", g.configPath)
			g.Config = &config
			return nil
		}
		return err
	}

	if err := toml.Unmarshal(content, &config); err != nil {
		return err
	}

	g.Config = &config

	return nil
}
