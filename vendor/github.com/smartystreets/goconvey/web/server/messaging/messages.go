package messaging

///////////////////////////////////////////////////////////////////////////////

type WatcherCommand struct {
	Instruction WatcherInstruction
	Details     string
}

type WatcherInstruction int

func (this WatcherInstruction) String() string {
	switch this {
	case WatcherPause:
		return "Pause"
	case WatcherResume:
		return "Resume"
	case WatcherIgnore:
		return "Ignore"
	case WatcherReinstate:
		return "Reinstate"
	case WatcherAdjustRoot:
		return "AdjustRoot"
	case WatcherExecute:
		return "Execute"
	case WatcherStop:
		return "Stop"
	default:
		return "UNKNOWN INSTRUCTION"
	}
}

const (
	WatcherPause WatcherInstruction = iota
	WatcherResume
	WatcherIgnore
	WatcherReinstate
	WatcherAdjustRoot
	WatcherExecute
	WatcherStop
)

///////////////////////////////////////////////////////////////////////////////

type Folders map[string]*Folder

type Folder struct {
	Path          string // key
	Root          string
	Ignored       bool
	Disabled      bool
	BuildTags     []string
	TestArguments []string
}

///////////////////////////////////////////////////////////////////////////////
