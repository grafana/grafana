package pipeline


// ForceLog should rarely be used. It forceable logs an entry to the
// Windows Event Log (on Windows) or to the SysLog (on Linux)
func ForceLog(level LogLevel, msg string) {
	if !enableForceLog {
		return
	}
	if sanitizer != nil {
		msg = sanitizer.SanitizeLogMessage(msg)
	}
	forceLog(level, msg)
}
