package data

// LogLevels consists of log levels for several types
var LogLevels = map[string][]string{
	"general": {"error", "warning", "info", "fatal", "trace", "debug"},
	"syslog":  {"emerg", "alert", "crit", "err", "warning", "notice", "info", "debug"},
	"apache":  {"emerg", "alert", "crit", "error", "warn", "notice", "info", "debug", "trace1-8"},
}
