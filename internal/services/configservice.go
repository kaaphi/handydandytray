package services

import (
	"context"
	"errors"
	"log/slog"
	"os"

	"github.com/pelletier/go-toml/v2"
	"github.com/wailsapp/wails/v3/pkg/application"
)

type ConfigService interface {
	Config() *Config
	Reload() error
}

type TimeTrackingConfig struct {
	DefaultCategory    string
	CategoryActivities map[string][]string
}

type Config struct {
	Timetracking TimeTrackingConfig
}

type DefaultConfigService struct {
	configPath string
	logger     *slog.Logger
	config     *Config
}

func NewConfigService(configPath string, logger *slog.Logger) *DefaultConfigService {
	return &DefaultConfigService{
		configPath: configPath,
		logger:     logger,
	}
}

func (g *DefaultConfigService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	return g.Reload()
}

func (g *DefaultConfigService) Reload() error {
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
			g.config = &config
			return nil
		}
		return err
	}

	if err := toml.Unmarshal(content, &config); err != nil {
		return err
	}

	g.config = &config

	return nil
}

func (g *DefaultConfigService) Config() *Config {
	return g.config
}

type SimpleConfigService struct {
	config *Config
}

func NewSimpleConfigService(config *Config) *SimpleConfigService {
	return &SimpleConfigService{
		config: config,
	}
}

func (g *SimpleConfigService) Config() *Config {
	return g.config
}

func (g *SimpleConfigService) Reload() error {
	return nil
}
