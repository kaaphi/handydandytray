package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	_ "modernc.org/sqlite"
)

// This is an "unexported" Wails service just so we can hook into the lifecycle for initializing the DB, etc.
type DbService struct {
	Db *sql.DB
}

func (g *DbService) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	db, err := initDB(ctx, "test.db")

	if err == nil {
		g.Db = db
	}

	return err
}

func (g *DbService) ServiceShutdown() error {
	if g.Db != nil {
		return g.Db.Close()
	}
	return nil
}

const targetSchemaVersion = 1

// InitDB initializes, configures, and migrates the SQLite database.
// The returned *sql.DB is safe for concurrent use by all Go services.
func initDB(ctx context.Context, dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// 1. Connection Pool Settings
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(1 * time.Hour)

	// 2. Critical SQLite Concurrency & Performance Settings
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",   // Enables concurrent reads while writing
		"PRAGMA synchronous = NORMAL;", // Faster writes, power-loss safe in WAL mode
		"PRAGMA busy_timeout = 5000;",  // Wait up to 5s for lock release before failing
		"PRAGMA foreign_keys = ON;",    // Enforce foreign key constraints
	}

	for _, pragma := range pragmas {
		if _, err := db.ExecContext(ctx, pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("apply pragma '%s': %w", pragma, err)
		}
	}

	// 3. Schema Migration
	if err := migrateSchema(ctx, db); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate schema: %w", err)
	}

	return db, nil
}

func migrateSchema(ctx context.Context, db *sql.DB) error {
	var currentVersion int
	if err := db.QueryRowContext(ctx, "PRAGMA user_version;").Scan(&currentVersion); err != nil {
		return fmt.Errorf("get user_version: %w", err)
	}

	if currentVersion >= targetSchemaVersion {
		return nil // Up to date
	}

	// Version 1 Migration
	if currentVersion < 1 {
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer tx.Rollback()

		schema := `
		CREATE TABLE IF NOT EXISTS todos (
			id TEXT PRIMARY KEY,
			data BLOB NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- JSON Index for fast lookups by completed
		CREATE INDEX IF NOT EXISTS idx_todos_completed_at ON todos(data->>'$.completedAt');
		`

		if _, err := tx.ExecContext(ctx, schema); err != nil {
			return fmt.Errorf("exec v1 schema: %w", err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit v1 migration: %w", err)
		}

		// Update schema version after successful commit
		if _, err := db.ExecContext(ctx, "PRAGMA user_version = 1;"); err != nil {
			return fmt.Errorf("set user_version = 1: %w", err)
		}
	}

	// Add future migrations here:
	// if currentVersion < 2 { ... }

	return nil
}
