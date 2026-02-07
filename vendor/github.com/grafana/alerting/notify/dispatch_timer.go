package notify

const (
	// DispatchTimerDefault represents the default dispatch timer behavior (no sync).
	DispatchTimerDefault DispatchTimer = iota
	// DispatchTimerSync represents synchronized dispatch timer (using flush log).
	DispatchTimerSync
)

// DispatchTimer represents the dispatch timer behavior.
type DispatchTimer int

// String returns the string representation of the DispatchTimer.
func (t DispatchTimer) String() string {
	switch t {
	case DispatchTimerSync:
		return "sync"
	case DispatchTimerDefault:
		return "default"
	default:
		return "default"
	}
}

// FromString sets the DispatchTimer based on the provided string.
func (t *DispatchTimer) FromString(s string) {
	var v DispatchTimer
	switch s {
	case "sync":
		v = DispatchTimerSync
	default:
		v = DispatchTimerDefault
	}
	(*t) = v
}
