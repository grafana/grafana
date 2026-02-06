package events // import "github.com/docker/docker/api/types/events"
import "github.com/docker/docker/api/types/filters"

// Type is used for event-types.
type Type string

// List of known event types.
const (
	BuilderEventType   Type = "builder"   // BuilderEventType is the event type that the builder generates.
	ConfigEventType    Type = "config"    // ConfigEventType is the event type that configs generate.
	ContainerEventType Type = "container" // ContainerEventType is the event type that containers generate.
	DaemonEventType    Type = "daemon"    // DaemonEventType is the event type that daemon generate.
	ImageEventType     Type = "image"     // ImageEventType is the event type that images generate.
	NetworkEventType   Type = "network"   // NetworkEventType is the event type that networks generate.
	NodeEventType      Type = "node"      // NodeEventType is the event type that nodes generate.
	PluginEventType    Type = "plugin"    // PluginEventType is the event type that plugins generate.
	SecretEventType    Type = "secret"    // SecretEventType is the event type that secrets generate.
	ServiceEventType   Type = "service"   // ServiceEventType is the event type that services generate.
	VolumeEventType    Type = "volume"    // VolumeEventType is the event type that volumes generate.
)

// Action is used for event-actions.
type Action string

const (
	ActionCreate       Action = "create"
	ActionStart        Action = "start"
	ActionRestart      Action = "restart"
	ActionStop         Action = "stop"
	ActionCheckpoint   Action = "checkpoint"
	ActionPause        Action = "pause"
	ActionUnPause      Action = "unpause"
	ActionAttach       Action = "attach"
	ActionDetach       Action = "detach"
	ActionResize       Action = "resize"
	ActionUpdate       Action = "update"
	ActionRename       Action = "rename"
	ActionKill         Action = "kill"
	ActionDie          Action = "die"
	ActionOOM          Action = "oom"
	ActionDestroy      Action = "destroy"
	ActionRemove       Action = "remove"
	ActionCommit       Action = "commit"
	ActionTop          Action = "top"
	ActionCopy         Action = "copy"
	ActionArchivePath  Action = "archive-path"
	ActionExtractToDir Action = "extract-to-dir"
	ActionExport       Action = "export"
	ActionImport       Action = "import"
	ActionSave         Action = "save"
	ActionLoad         Action = "load"
	ActionTag          Action = "tag"
	ActionUnTag        Action = "untag"
	ActionPush         Action = "push"
	ActionPull         Action = "pull"
	ActionPrune        Action = "prune"
	ActionDelete       Action = "delete"
	ActionEnable       Action = "enable"
	ActionDisable      Action = "disable"
	ActionConnect      Action = "connect"
	ActionDisconnect   Action = "disconnect"
	ActionReload       Action = "reload"
	ActionMount        Action = "mount"
	ActionUnmount      Action = "unmount"

	// ActionExecCreate is the prefix used for exec_create events. These
	// event-actions are commonly followed by a colon and space (": "),
	// and the command that's defined for the exec, for example:
	//
	//	exec_create: /bin/sh -c 'echo hello'
	//
	// This is far from ideal; it's a compromise to allow filtering and
	// to preserve backward-compatibility.
	ActionExecCreate Action = "exec_create"
	// ActionExecStart is the prefix used for exec_create events. These
	// event-actions are commonly followed by a colon and space (": "),
	// and the command that's defined for the exec, for example:
	//
	//	exec_start: /bin/sh -c 'echo hello'
	//
	// This is far from ideal; it's a compromise to allow filtering and
	// to preserve backward-compatibility.
	ActionExecStart  Action = "exec_start"
	ActionExecDie    Action = "exec_die"
	ActionExecDetach Action = "exec_detach"

	// ActionHealthStatus is the prefix to use for health_status events.
	//
	// Health-status events can either have a pre-defined status, in which
	// case the "health_status" action is followed by a colon, or can be
	// "free-form", in which case they're followed by the output of the
	// health-check output.
	//
	// This is far form ideal, and a compromise to allow filtering, and
	// to preserve backward-compatibility.
	ActionHealthStatus          Action = "health_status"
	ActionHealthStatusRunning   Action = "health_status: running"
	ActionHealthStatusHealthy   Action = "health_status: healthy"
	ActionHealthStatusUnhealthy Action = "health_status: unhealthy"
)

// Actor describes something that generates events,
// like a container, or a network, or a volume.
// It has a defined name and a set of attributes.
// The container attributes are its labels, other actors
// can generate these attributes from other properties.
type Actor struct {
	ID         string
	Attributes map[string]string
}

// Message represents the information an event contains
type Message struct {
	// Deprecated information from JSONMessage.
	// With data only in container events.
	Status string `json:"status,omitempty"` // Deprecated: use Action instead.
	ID     string `json:"id,omitempty"`     // Deprecated: use Actor.ID instead.
	From   string `json:"from,omitempty"`   // Deprecated: use Actor.Attributes["image"] instead.

	Type   Type
	Action Action
	Actor  Actor
	// Engine events are local scope. Cluster events are swarm scope.
	Scope string `json:"scope,omitempty"`

	Time     int64 `json:"time,omitempty"`
	TimeNano int64 `json:"timeNano,omitempty"`
}

// ListOptions holds parameters to filter events with.
type ListOptions struct {
	Since   string
	Until   string
	Filters filters.Args
}
