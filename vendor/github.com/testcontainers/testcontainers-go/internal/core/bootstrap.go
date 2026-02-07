package core

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/shirou/gopsutil/v4/process"
)

// sessionID returns a unique session ID for the current test session. Because each Go package
// will be run in a separate process, we need a way to identify the current test session.
// By test session, we mean:
//   - a single "go test" invocation (including flags)
//   - a single "go test ./..." invocation (including flags)
//   - the execution of a single test or a set of tests using the IDE
//
// As a consequence, with the sole goal of aggregating test execution across multiple
// packages, this function will use the parent process ID (pid) of the current process
// and its creation date, to use it to generate a unique session ID. We are using the parent pid because
// the current process will be a child process of:
//   - the process that is running the tests, e.g.: "go test";
//   - the process that is running the application in development mode, e.g. "go run main.go -tags dev";
//   - the process that is running the tests in the IDE, e.g.: "go test ./...".
//
// Finally, we will hash the combination of the "testcontainers-go:" string with the parent pid
// and the creation date of that parent process to generate a unique session ID.
//
// This sessionID will be used to:
//   - identify the test session, aggregating the test execution of multiple packages in the same test session.
//   - tag the containers created by testcontainers-go, adding a label to the container with the session ID.
var sessionID string

// projectPath returns the current working directory of the parent test process running Testcontainers for Go.
// If it's not possible to get that directory, the library will use the current working directory. If again
// it's not possible to get the current working directory, the library will use a temporary directory.
var projectPath string

// processID returns a unique ID for the current test process. Because each Go package will be run in a separate process,
// we need a way to identify the current test process, in the form of a UUID
var processID string

const sessionIDPlaceholder = "testcontainers-go:%d:%d"

func init() {
	processID = uuid.New().String()

	parentPid := os.Getppid()
	var createTime int64
	fallbackCwd, err := os.Getwd()
	if err != nil {
		// very unlikely to fail, but if it does, we will use a temp dir
		fallbackCwd = os.TempDir()
	}

	processes, err := process.Processes()
	if err != nil {
		sessionID = uuid.New().String()
		projectPath = fallbackCwd
		return
	}

	for _, p := range processes {
		if int(p.Pid) != parentPid {
			continue
		}

		cwd, err := p.Cwd()
		if err != nil {
			cwd = fallbackCwd
		}
		projectPath = cwd

		t, err := p.CreateTime()
		if err != nil {
			sessionID = uuid.New().String()
			return
		}

		createTime = t
		break
	}

	hasher := sha256.New()
	_, err = hasher.Write([]byte(fmt.Sprintf(sessionIDPlaceholder, parentPid, createTime)))
	if err != nil {
		sessionID = uuid.New().String()
		return
	}

	sessionID = hex.EncodeToString(hasher.Sum(nil))
}

func ProcessID() string {
	return processID
}

func ProjectPath() string {
	return projectPath
}

func SessionID() string {
	return sessionID
}
