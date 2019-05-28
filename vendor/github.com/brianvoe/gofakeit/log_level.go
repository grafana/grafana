package gofakeit

import (
	"github.com/brianvoe/gofakeit/data"
)

// LogLevel will generate a random log level
// See data/LogLevels for list of available levels
func LogLevel(logType string) string {
	if _, ok := data.LogLevels[logType]; ok {
		return getRandValue([]string{"log_level", logType})
	}

	return getRandValue([]string{"log_level", "general"})
}
