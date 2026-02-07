package centrifuge

// LogLevel describes the chosen log level.
type LogLevel int

const (
	// LogLevelNone means no logging.
	LogLevelNone LogLevel = iota
	// LogLevelTrace turns on trace logs - should only be used during development. This
	// log level shows all client-server communication.
	LogLevelTrace
	// LogLevelDebug turns on debug logs - it's generally too much for production in normal
	// conditions but can help when developing and investigating problems in production.
	LogLevelDebug
	// LogLevelInfo logs useful server information. This includes various information
	// about problems with client connections which is not Centrifuge errors but
	// in most situations malformed client behaviour.
	LogLevelInfo
	// LogLevelWarn logs server warnings. This may contain tips for a developer about things
	// which should be addressed but usually not immediately.
	LogLevelWarn
	// LogLevelError level logs only server errors. This is logging that means non-working
	// Centrifuge and may require effort from developers/administrators to make things
	// work again.
	LogLevelError
)

// levelToString matches LogLevel to its string representation.
var levelToString = map[LogLevel]string{
	LogLevelTrace: "trace",
	LogLevelDebug: "debug",
	LogLevelInfo:  "info",
	LogLevelWarn:  "warn",
	LogLevelError: "error",
	LogLevelNone:  "none",
}

// LogLevelToString transforms Level to its string representation.
func LogLevelToString(l LogLevel) string {
	return levelToString[l]
}

// LogEntry represents log entry.
type LogEntry struct {
	Level   LogLevel
	Message string
	Fields  map[string]any
	Error   error
}

// buildLogEntry helps to create Entry.
func buildLogEntry(level LogLevel, err error, message string, fields map[string]any) LogEntry {
	var f map[string]any
	if err != nil {
		f = make(map[string]any, len(fields)+1)
		for k, v := range fields {
			f[k] = v
		}
		f["error"] = err.Error()
	} else {
		f = fields
	}
	return LogEntry{
		Level:   level,
		Message: message,
		Fields:  f,
		Error:   err,
	}
}

// newLogEntry creates new LogEntry.
func newLogEntry(level LogLevel, message string, fields map[string]any) LogEntry {
	return buildLogEntry(level, nil, message, fields)
}

// newErrorLogEntry creates new LogEntry with LogLevelError and error attached to it.
func newErrorLogEntry(err error, message string, fields map[string]any) LogEntry {
	return buildLogEntry(LogLevelError, err, message, fields)
}

// LogHandler handles log entries - i.e. writes into correct destination if necessary.
type LogHandler func(LogEntry)

func newLogger(level LogLevel, handler LogHandler) *logger {
	return &logger{
		level:   level,
		handler: handler,
	}
}

// logger can log entries.
type logger struct {
	level   LogLevel
	handler LogHandler
}

// log calls log handler with provided LogEntry.
func (l *logger) log(entry LogEntry) {
	if l == nil {
		return
	}
	if l.enabled(entry.Level) {
		l.handler(entry)
	}
}

// enabled says whether specified Level enabled or not.
func (l *logger) enabled(level LogLevel) bool {
	if l == nil {
		return false
	}
	return level >= l.level && l.level != LogLevelNone
}
