package logger

import "os"

type Logger interface {
	Printf(format string, args ...interface{})
	Debugf(format string, args ...interface{})
}

func DebugEnabled() bool {
	d := os.Getenv("SWAGGER_DEBUG")
	if d != "" && d != "false" && d != "0" {
		return true
	}
	d = os.Getenv("DEBUG")
	if d != "" && d != "false" && d != "0" {
		return true
	}
	return false
}
