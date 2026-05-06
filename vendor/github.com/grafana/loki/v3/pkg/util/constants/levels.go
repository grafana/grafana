package constants

const (
	LevelLabel       = "detected_level"
	LogLevelUnknown  = "unknown"
	LogLevelDebug    = "debug"
	LogLevelInfo     = "info"
	LogLevelWarn     = "warn"
	LogLevelError    = "error"
	LogLevelFatal    = "fatal"
	LogLevelCritical = "critical"
	LogLevelTrace    = "trace"
)

var LogLevels = []string{
	LogLevelUnknown,
	LogLevelDebug,
	LogLevelInfo,
	LogLevelWarn,
	LogLevelError,
	LogLevelFatal,
	LogLevelCritical,
	LogLevelTrace,
}
