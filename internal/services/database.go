package services

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	_ "modernc.org/sqlite"
)

// This is an "unexported" Wails service just so we can hook into the lifecycle for initializing the DB, etc.
type DbService struct {
	Db     *sql.DB
	dbPath string
	logger *slog.Logger
}

func NewDbService(logger *slog.Logger, dbPath string) *DbService {
	return &DbService{
		dbPath: dbPath,
		logger: logger,
	}
}

func (g *DbService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	err := g.initDB(ctx)

	return err
}

func (g *DbService) ServiceShutdown() error {
	if g.Db != nil {
		return g.Db.Close()
	}
	return nil
}

type schemaVersion struct {
	version       int
	migrateAction func(ctx context.Context, tx *sql.Tx) error
}

func createSimpleMigrateAction(schema string) func(ctx context.Context, tx *sql.Tx) error {
	return func(ctx context.Context, tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, schema)
		return err
	}
}

var schemaVersions = [...]schemaVersion{
	{
		version: 1,
		migrateAction: createSimpleMigrateAction(`
		CREATE TABLE IF NOT EXISTS todos (
			id TEXT PRIMARY KEY,
			data BLOB NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- JSON Index for fast lookups by completed
		CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(data->>'$.completedAt');
		`),
	},
	{
		version: 2,
		migrateAction: createSimpleMigrateAction(`
		CREATE TABLE IF NOT EXISTS timetracking_intervals (
			id INTEGER PRIMARY KEY,
			interval_start DATETIME,
			interval_end DATETIME,
			activity TEXT,
			activity_minutes INTEGER
		);

		CREATE INDEX IF NOT EXISTS idx_timetracking_interval_start ON timetracking_intervals(interval_start);
		`),
	},
}

// InitDB initializes, configures, and migrates the SQLite database.
// The returned *sql.DB is safe for concurrent use by all Go services.
func (g *DbService) initDB(ctx context.Context) error {
	g.logger.Info("Initializing DB", "path", g.dbPath)
	db, err := sql.Open("sqlite", fmt.Sprintf("file:%s?_time_format=sqlite&_texttotime", g.dbPath))
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}

	// Connection Pool Settings
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(1 * time.Hour)

	// Critical SQLite Concurrency & Performance Settings
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",   // Enables concurrent reads while writing
		"PRAGMA synchronous = NORMAL;", // Faster writes, power-loss safe in WAL mode
		"PRAGMA busy_timeout = 5000;",  // Wait up to 5s for lock release before failing
		"PRAGMA foreign_keys = ON;",    // Enforce foreign key constraints
	}

	for _, pragma := range pragmas {
		if _, err := db.ExecContext(ctx, pragma); err != nil {
			db.Close()
			return fmt.Errorf("apply pragma '%s': %w", pragma, err)
		}
	}

	g.Db = db

	// Schema Migration
	if err := g.migrateSchema(ctx); err != nil {
		db.Close()
		return fmt.Errorf("migrate schema: %w", err)
	}

	return nil
}

func (g *DbService) migrateSchema(ctx context.Context) error {
	var currentVersion int
	if err := g.Db.QueryRowContext(ctx, "PRAGMA user_version;").Scan(&currentVersion); err != nil {
		return fmt.Errorf("get user_version: %w", err)
	}

	var targetSchemaVersion = schemaVersions[len(schemaVersions)-1].version

	if currentVersion >= targetSchemaVersion {
		g.logger.Debug("DB schema up-to-date", "currentVersion", currentVersion, "targetVersion", targetSchemaVersion)
		return nil // Up to date
	}

	g.logger.Info("DB schema version needs to be upgraded", "currentVersion", currentVersion, "targetVersion", targetSchemaVersion)

	for _, schemaVersion := range schemaVersions {
		if currentVersion < schemaVersion.version {
			if err := g.executeSchemaVersionMigration(ctx, &schemaVersion); err != nil {
				return err
			}
		}
	}

	g.logger.Info("Schema version upgrade complete.", "version", targetSchemaVersion)

	return nil
}

func (g *DbService) executeSchemaVersionMigration(ctx context.Context, schemaVersion *schemaVersion) error {
	g.logger.Info("Executing schema migration for version", "version", schemaVersion.version)
	tx, err := g.Db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := schemaVersion.migrateAction(ctx, tx); err != nil {
		return fmt.Errorf("exec v%d schema: %w", schemaVersion.version, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit v%d migration: %w", schemaVersion.version, err)
	}

	// Update schema version after successful commit
	if _, err := g.Db.ExecContext(ctx, fmt.Sprintf("PRAGMA user_version = %d;", schemaVersion.version)); err != nil {
		return fmt.Errorf("set user_version = %d: %w", schemaVersion.version, err)
	}

	return nil
}
