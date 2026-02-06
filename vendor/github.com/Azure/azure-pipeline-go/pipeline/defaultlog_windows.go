package pipeline

import (
	"os"
	"syscall"
	"unsafe"
)

// forceLog should rarely be used. It forceable logs an entry to the
// Windows Event Log (on Windows) or to the SysLog (on Linux)
func forceLog(level LogLevel, msg string) {
	var el eventType
	switch level {
	case LogError, LogFatal, LogPanic:
		el = elError
	case LogWarning:
		el = elWarning
	case LogInfo:
		el = elInfo
	}
	// We are logging it, ensure trailing newline
	if len(msg) == 0 || msg[len(msg)-1] != '\n' {
		msg += "\n" // Ensure trailing newline
	}
	reportEvent(el, 0, msg)
}

type eventType int16

const (
	elSuccess eventType = 0
	elError   eventType = 1
	elWarning eventType = 2
	elInfo    eventType = 4
)

var reportEvent = func() func(eventType eventType, eventID int32, msg string) {
	advAPI32 := syscall.MustLoadDLL("advapi32.dll") // lower case to tie in with Go's sysdll registration
	registerEventSource := advAPI32.MustFindProc("RegisterEventSourceW")

	sourceName, _ := os.Executable()
	sourceNameUTF16, _ := syscall.UTF16PtrFromString(sourceName)
	handle, _, lastErr := registerEventSource.Call(uintptr(0), uintptr(unsafe.Pointer(sourceNameUTF16)))
	if lastErr == nil { // On error, logging is a no-op
		return func(eventType eventType, eventID int32, msg string) {}
	}
	reportEvent := advAPI32.MustFindProc("ReportEventW")
	return func(eventType eventType, eventID int32, msg string) {
		s, _ := syscall.UTF16PtrFromString(msg)
		_, _, _ = reportEvent.Call(
			uintptr(handle),             // HANDLE  hEventLog
			uintptr(eventType),          // WORD    wType
			uintptr(0),                  // WORD    wCategory
			uintptr(eventID),            // DWORD   dwEventID
			uintptr(0),                  // PSID    lpUserSid
			uintptr(1),                  // WORD    wNumStrings
			uintptr(0),                  // DWORD   dwDataSize
			uintptr(unsafe.Pointer(&s)), // LPCTSTR *lpStrings
			uintptr(0))                  // LPVOID  lpRawData
	}
}()
