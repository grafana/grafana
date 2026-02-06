package mssql

import (
	"context"

	"github.com/microsoft/go-mssqldb/msdsn"
)

const (
	logErrors      = uint64(msdsn.LogErrors)
	logMessages    = uint64(msdsn.LogMessages)
	logRows        = uint64(msdsn.LogRows)
	logSQL         = uint64(msdsn.LogSQL)
	logParams      = uint64(msdsn.LogParams)
	logTransaction = uint64(msdsn.LogTransaction)
	logDebug       = uint64(msdsn.LogDebug)
	logRetries     = uint64(msdsn.LogRetries)
)

// Logger is an interface you can implement to have the go-msqldb
// driver automatically log detailed information on your behalf
type Logger interface {
	Printf(format string, v ...interface{})
	Println(v ...interface{})
}

// ContextLogger is an interface that provides more information
// than Logger and lets you log messages yourself. This gives you
// more information to log (e.g. trace IDs in the context), more
// control over the logging activity (e.g. log it, trace it, or
// log and trace it, depending on the class of message), and lets
// you log in exactly the format you want.
type ContextLogger interface {
	Log(ctx context.Context, category msdsn.Log, msg string)
}

// optionalLogger implements the ContextLogger interface with
// a default "do nothing" behavior that can be overridden by an
// optional ContextLogger supplied by the user.
type optionalLogger struct {
	logger ContextLogger
}

// Log does nothing unless the user has specified an optional
// ContextLogger to override the "do nothing" default behavior.
func (o optionalLogger) Log(ctx context.Context, category msdsn.Log, msg string) {
	if nil != o.logger {
		o.logger.Log(ctx, category, msg)
	}
}

// loggerAdapter converts Logger interfaces into ContextLogger
// interfaces. It provides backwards compatibility.
type loggerAdapter struct {
	logger Logger
}

// Log passes the message to the underlying Logger interface's
// Println function, emulating the orignal Logger behavior.
func (la loggerAdapter) Log(_ context.Context, category msdsn.Log, msg string) {

	// Add prefix for certain categories
	switch category {
	case msdsn.LogErrors:
		msg = "ERROR: " + msg
	case msdsn.LogRetries:
		msg = "RETRY: " + msg
	}

	la.logger.Println(msg)
}
