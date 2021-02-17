package centrifuge

// LogLevel describes the chosen log level.
type LogLevel int

const (
	// LogLevelNone means no logging.
	LogLevelNone LogLevel = iota
	// LogLevelDebug turns on debug logs - its generally too much for production in normal
	// conditions but can help when developing and investigating problems in production.
	LogLevelDebug
	// LogLevelInfo is logs useful server information. This includes various information
	// about problems with client connections which is not Centrifuge errors but
	// in most situations malformed client behaviour.
	LogLevelInfo
	// LogLevelError level logs only server errors. This is logging that means non-working
	// Centrifuge and maybe effort from developers/administrators to make things
	// work again.
	LogLevelError
)

// levelToString matches LogLevel to its string representation.
var levelToString = map[LogLevel]string{
	LogLevelDebug: "debug",
	LogLevelInfo:  "info",
	LogLevelError: "error",
	LogLevelNone:  "none",
}

// LogLevelToString transforms Level to its string representation.
func LogLevelToString(l LogLevel) string {
	if t, ok := levelToString[l]; ok {
		return t
	}
	return ""
}

// LogEntry represents log entry.
type LogEntry struct {
	Level   LogLevel
	Message string
	Fields  map[string]interface{}
}

// newLogEntry helps to create Entry.
func newLogEntry(level LogLevel, message string, fields ...map[string]interface{}) LogEntry {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	return LogEntry{
		Level:   level,
		Message: message,
		Fields:  f,
	}
}

// NewLogEntry creates new LogEntry.
func NewLogEntry(level LogLevel, message string, fields ...map[string]interface{}) LogEntry {
	return newLogEntry(level, message, fields...)
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
