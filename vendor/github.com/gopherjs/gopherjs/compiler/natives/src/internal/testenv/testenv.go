// +build js

package testenv

import (
	"runtime"
	"strings"
)

// HasExec reports whether the current system can start new processes
// using os.StartProcess or (more commonly) exec.Command.
func HasExec() bool {
	switch runtime.GOOS {
	case "nacl":
		return false
	case "darwin":
		if strings.HasPrefix(runtime.GOARCH, "arm") {
			return false
		}
	}
	switch runtime.GOARCH {
	case "js":
		return false
	}
	return true
}
