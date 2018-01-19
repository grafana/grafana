// +build js

package os

import (
	"errors"

	"github.com/gopherjs/gopherjs/js"
)

func runtime_args() []string { // not called on Windows
	return Args
}

func init() {
	if process := js.Global.Get("process"); process != js.Undefined {
		argv := process.Get("argv")
		Args = make([]string, argv.Length()-1)
		for i := 0; i < argv.Length()-1; i++ {
			Args[i] = argv.Index(i + 1).String()
		}
	}
	if len(Args) == 0 {
		Args = []string{"?"}
	}
}

func runtime_beforeExit() {}

func executable() (string, error) {
	return "", errors.New("Executable not implemented for GOARCH=js")
}
