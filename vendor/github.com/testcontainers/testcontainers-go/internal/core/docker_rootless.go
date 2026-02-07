package core

import (
	"context"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
)

var (
	ErrRootlessDockerNotFound               = errors.New("rootless Docker not found")
	ErrRootlessDockerNotFoundHomeDesktopDir = errors.New("checked path: ~/.docker/desktop/docker.sock")
	ErrRootlessDockerNotFoundHomeRunDir     = errors.New("checked path: ~/.docker/run/docker.sock")
	ErrRootlessDockerNotFoundRunDir         = errors.New("checked path: /run/user/${uid}/docker.sock")
	ErrRootlessDockerNotFoundXDGRuntimeDir  = errors.New("checked path: $XDG_RUNTIME_DIR")
	ErrRootlessDockerNotSupportedWindows    = errors.New("rootless Docker is not supported on Windows")
	ErrXDGRuntimeDirNotSet                  = errors.New("XDG_RUNTIME_DIR is not set")
)

// baseRunDir is the base directory for the "/run/user/${uid}" directory.
// It is a variable so it can be modified for testing.
var baseRunDir = "/run"

// IsWindows returns if the current OS is Windows. For that it checks the GOOS environment variable or the runtime.GOOS constant.
func IsWindows() bool {
	return os.Getenv("GOOS") == "windows" || runtime.GOOS == "windows"
}

// rootlessDockerSocketPath returns if the path to the rootless Docker socket exists.
// The rootless socket path is determined by the following order:
//
//  1. XDG_RUNTIME_DIR environment variable.
//  2. ~/.docker/run/docker.sock file.
//  3. ~/.docker/desktop/docker.sock file.
//  4. /run/user/${uid}/docker.sock file.
//  5. Else, return ErrRootlessDockerNotFound, wrapping specific errors for each of the above paths.
//
// It should include the Docker socket schema (unix://) in the returned path.
func rootlessDockerSocketPath(_ context.Context) (string, error) {
	// adding a manner to test it on non-windows machines, setting the GOOS env var to windows
	// This is needed because runtime.GOOS is a constant that returns the OS of the machine running the test
	if IsWindows() {
		return "", ErrRootlessDockerNotSupportedWindows
	}

	socketPathFns := []func() (string, error){
		rootlessSocketPathFromEnv,
		rootlessSocketPathFromHomeRunDir,
		rootlessSocketPathFromHomeDesktopDir,
		rootlessSocketPathFromRunDir,
	}

	var errs []error
	for _, socketPathFn := range socketPathFns {
		s, err := socketPathFn()
		if err != nil {
			if !isHostNotSet(err) {
				errs = append(errs, err)
			}
			continue
		}

		return DockerSocketSchema + s, nil
	}

	if len(errs) > 0 {
		return "", errors.Join(errs...)
	}

	return "", ErrRootlessDockerNotFound
}

func fileExists(f string) bool {
	_, err := os.Stat(f)
	return err == nil
}

func parseURL(s string) (string, error) {
	hostURL, err := url.Parse(s)
	if err != nil {
		return "", err
	}

	switch hostURL.Scheme {
	case "unix", "npipe":
		return hostURL.Path, nil
	case "tcp":
		// return the original URL, as it is a valid TCP URL
		return s, nil
	default:
		return "", ErrNoUnixSchema
	}
}

// rootlessSocketPathFromEnv returns the path to the rootless Docker socket from the XDG_RUNTIME_DIR environment variable.
// It should include the Docker socket schema (unix://) in the returned path.
func rootlessSocketPathFromEnv() (string, error) {
	xdgRuntimeDir, exists := os.LookupEnv("XDG_RUNTIME_DIR")
	if exists {
		f := filepath.Join(xdgRuntimeDir, "docker.sock")
		if fileExists(f) {
			return f, nil
		}

		return "", ErrRootlessDockerNotFoundXDGRuntimeDir
	}

	return "", ErrXDGRuntimeDirNotSet
}

// rootlessSocketPathFromHomeRunDir returns the path to the rootless Docker socket from the ~/.docker/run/docker.sock file.
func rootlessSocketPathFromHomeRunDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	f := filepath.Join(home, ".docker", "run", "docker.sock")
	if fileExists(f) {
		return f, nil
	}
	return "", ErrRootlessDockerNotFoundHomeRunDir
}

// rootlessSocketPathFromHomeDesktopDir returns the path to the rootless Docker socket from the ~/.docker/desktop/docker.sock file.
func rootlessSocketPathFromHomeDesktopDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	f := filepath.Join(home, ".docker", "desktop", "docker.sock")
	if fileExists(f) {
		return f, nil
	}
	return "", ErrRootlessDockerNotFoundHomeDesktopDir
}

// rootlessSocketPathFromRunDir returns the path to the rootless Docker socket from the /run/user/<uid>/docker.sock file.
func rootlessSocketPathFromRunDir() (string, error) {
	uid := os.Getuid()
	f := filepath.Join(baseRunDir, "user", strconv.Itoa(uid), "docker.sock")
	if fileExists(f) {
		return f, nil
	}
	return "", ErrRootlessDockerNotFoundRunDir
}
