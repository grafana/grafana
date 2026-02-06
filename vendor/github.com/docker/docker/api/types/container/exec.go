package container

import "github.com/docker/docker/api/types/common"

// ExecCreateResponse is the response for a successful exec-create request.
// It holds the ID of the exec that was created.
//
// TODO(thaJeztah): make this a distinct type.
type ExecCreateResponse = common.IDResponse

// ExecOptions is a small subset of the Config struct that holds the configuration
// for the exec feature of docker.
type ExecOptions struct {
	User         string   // User that will run the command
	Privileged   bool     // Is the container in privileged mode
	Tty          bool     // Attach standard streams to a tty.
	ConsoleSize  *[2]uint `json:",omitempty"` // Initial console size [height, width]
	AttachStdin  bool     // Attach the standard input, makes possible user interaction
	AttachStderr bool     // Attach the standard error
	AttachStdout bool     // Attach the standard output
	Detach       bool     // Execute in detach mode
	DetachKeys   string   // Escape keys for detach
	Env          []string // Environment variables
	WorkingDir   string   // Working directory
	Cmd          []string // Execution commands and args
}

// ExecStartOptions is a temp struct used by execStart
// Config fields is part of ExecConfig in runconfig package
type ExecStartOptions struct {
	// ExecStart will first check if it's detached
	Detach bool
	// Check if there's a tty
	Tty bool
	// Terminal size [height, width], unused if Tty == false
	ConsoleSize *[2]uint `json:",omitempty"`
}

// ExecAttachOptions is a temp struct used by execAttach.
//
// TODO(thaJeztah): make this a separate type; ContainerExecAttach does not use the Detach option, and cannot run detached.
type ExecAttachOptions = ExecStartOptions

// ExecInspect holds information returned by exec inspect.
type ExecInspect struct {
	ExecID      string `json:"ID"`
	ContainerID string
	Running     bool
	ExitCode    int
	Pid         int
}
