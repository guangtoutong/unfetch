package queue

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"

	"unfetch/core/types"
)

const schema = `
CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    url         TEXT NOT NULL,
    filename    TEXT NOT NULL,
    save_path   TEXT NOT NULL,
    type        TEXT NOT NULL,
    status      TEXT NOT NULL,
    total_bytes INTEGER NOT NULL DEFAULT 0,
    done_bytes  INTEGER NOT NULL DEFAULT 0,
    threads     INTEGER NOT NULL DEFAULT 8,
    proxy       TEXT NOT NULL DEFAULT '',
    quality     TEXT NOT NULL DEFAULT '',
    cookies     TEXT NOT NULL DEFAULT '',
    play_after  INTEGER NOT NULL DEFAULT 0,
    trashed     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    finished_at TEXT,
    error       TEXT NOT NULL DEFAULT '',
    metadata    TEXT
);
`

// Store 提供任务持久化能力
type Store struct {
	db *sql.DB
}

func dataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return filepath.Join(home, ".local", "share", "unfetch")
}

// NewStore 打开（或创建）SQLite 数据库
func NewStore() (*Store, error) {
	dir := dataDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	dbPath := filepath.Join(dir, "tasks.db")

	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1) // sqlite 单连接

	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("create schema: %w", err)
	}

	// 迁移：为旧数据库添加新列（顺序：trashed → 二档新增）
	migrations := []string{
		`ALTER TABLE tasks ADD COLUMN trashed INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE tasks ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE tasks ADD COLUMN start_at TEXT`,
		`ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE tasks ADD COLUMN expected_sha256 TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE tasks ADD COLUMN expected_md5 TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE tasks ADD COLUMN actual_sha256 TEXT NOT NULL DEFAULT ''`,
	}
	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			if !strings.Contains(err.Error(), "duplicate column") {
				slog.Warn("migrate", "sql", m, "err", err)
			}
		}
	}

	slog.Info("sqlite store opened", "path", dbPath)
	return &Store{db: db}, nil
}

// Close 关闭数据库连接
func (s *Store) Close() error {
	return s.db.Close()
}

// SaveTask 插入或更新任务
func (s *Store) SaveTask(task *types.Task) error {
	meta, err := json.Marshal(task.Metadata)
	if err != nil {
		meta = []byte("null")
	}

	var finishedAt *string
	if task.FinishedAt != nil {
		t := task.FinishedAt.Format(time.RFC3339)
		finishedAt = &t
	}

	playAfter := 0
	if task.PlayAfter {
		playAfter = 1
	}
	trashed := 0
	if task.Trashed {
		trashed = 1
	}
	var startAt *string
	if task.StartAt != nil {
		s := task.StartAt.Format(time.RFC3339)
		startAt = &s
	}
	tagsJSON, _ := json.Marshal(task.Tags)

	_, err = s.db.Exec(`
		INSERT INTO tasks
			(id, url, filename, save_path, type, status, total_bytes, done_bytes, threads,
			 proxy, quality, cookies, play_after, trashed, retry_count, start_at, tags,
			 expected_sha256, expected_md5, actual_sha256,
			 created_at, finished_at, error, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			filename    = excluded.filename,
			save_path   = excluded.save_path,
			status      = excluded.status,
			total_bytes = excluded.total_bytes,
			done_bytes  = excluded.done_bytes,
			threads     = excluded.threads,
			proxy       = excluded.proxy,
			quality     = excluded.quality,
			cookies     = excluded.cookies,
			play_after  = excluded.play_after,
			trashed     = excluded.trashed,
			retry_count = excluded.retry_count,
			start_at    = excluded.start_at,
			tags        = excluded.tags,
			expected_sha256 = excluded.expected_sha256,
			expected_md5 = excluded.expected_md5,
			actual_sha256 = excluded.actual_sha256,
			finished_at = excluded.finished_at,
			error       = excluded.error,
			metadata    = excluded.metadata
	`,
		task.ID, task.URL, task.Filename, task.SavePath,
		string(task.Type), string(task.Status),
		task.TotalBytes, task.DoneBytes,
		task.Threads, task.Proxy, task.Quality, task.Cookies,
		playAfter, trashed, task.RetryCount, startAt, string(tagsJSON),
		task.ExpectedSHA256, task.ExpectedMD5, task.ActualSHA256,
		task.CreatedAt.Format(time.RFC3339),
		finishedAt,
		task.Error,
		string(meta),
	)
	if err != nil {
		return fmt.Errorf("save task %s: %w", task.ID, err)
	}
	return nil
}

// DeleteTask 从数据库中删除任务记录
func (s *Store) DeleteTask(id string) error {
	_, err := s.db.Exec("DELETE FROM tasks WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete task %s: %w", id, err)
	}
	return nil
}

// LoadActiveTasks 加载需要在内存中保留的任务：非完成的活动任务 + 所有垃圾桶任务
func (s *Store) LoadActiveTasks() ([]*types.Task, error) {
	rows, err := s.db.Query(`
		SELECT id, url, filename, save_path, type, status,
		       total_bytes, done_bytes, threads, proxy, quality, cookies,
		       play_after, trashed, retry_count, start_at, tags,
		       expected_sha256, expected_md5, actual_sha256,
		       created_at, finished_at, error, metadata
		FROM tasks
		WHERE status NOT IN ('done') OR trashed = 1
		ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*types.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			slog.Warn("scan task error", "err", err)
			continue
		}
		// downloading 重启后变为 paused（需要用户手动恢复）
		if t.Status == types.StatusDownloading {
			t.Status = types.StatusPaused
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}
	return tasks, nil
}

func scanTask(rows *sql.Rows) (*types.Task, error) {
	var (
		t          types.Task
		taskType   string
		status     string
		playAfter  int
		trashed    int
		startAt    sql.NullString
		tagsJSON   sql.NullString
		createdAt  string
		finishedAt sql.NullString
		metaJSON   sql.NullString
	)

	err := rows.Scan(
		&t.ID, &t.URL, &t.Filename, &t.SavePath,
		&taskType, &status,
		&t.TotalBytes, &t.DoneBytes,
		&t.Threads, &t.Proxy, &t.Quality, &t.Cookies,
		&playAfter, &trashed, &t.RetryCount, &startAt, &tagsJSON,
		&t.ExpectedSHA256, &t.ExpectedMD5, &t.ActualSHA256,
		&createdAt, &finishedAt, &t.Error, &metaJSON,
	)
	if err != nil {
		return nil, err
	}

	t.Type = types.TaskType(taskType)
	t.Status = types.Status(status)
	t.PlayAfter = playAfter == 1
	t.Trashed = trashed == 1
	t.ETA = -1
	if startAt.Valid && startAt.String != "" {
		if sa, err := time.Parse(time.RFC3339, startAt.String); err == nil {
			t.StartAt = &sa
		}
	}
	if tagsJSON.Valid && tagsJSON.String != "" {
		_ = json.Unmarshal([]byte(tagsJSON.String), &t.Tags)
	}

	if ca, err := time.Parse(time.RFC3339, createdAt); err == nil {
		t.CreatedAt = ca
	}
	if finishedAt.Valid && finishedAt.String != "" {
		if fa, err := time.Parse(time.RFC3339, finishedAt.String); err == nil {
			t.FinishedAt = &fa
		}
	}
	if metaJSON.Valid && metaJSON.String != "" && metaJSON.String != "null" {
		var meta types.TaskMeta
		if err := json.Unmarshal([]byte(metaJSON.String), &meta); err == nil {
			t.Metadata = &meta
		}
	}

	return &t, nil
}
