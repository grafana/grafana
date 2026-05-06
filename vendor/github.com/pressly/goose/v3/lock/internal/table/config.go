package table

import (
	"log/slog"
	"time"
)

// Config holds configuration for table locker.
type Config struct {
	TableName         string
	LockID            int64
	LeaseDuration     time.Duration
	HeartbeatInterval time.Duration
	LockTimeout       ProbeConfig
	UnlockTimeout     ProbeConfig

	// Optional logger for lock operations
	Logger *slog.Logger

	// Optional custom retry policy for database errors
	RetryPolicy RetryPolicyFunc
}

// ProbeConfig holds retry configuration.
type ProbeConfig struct {
	IntervalDuration time.Duration
	FailureThreshold uint64
}
