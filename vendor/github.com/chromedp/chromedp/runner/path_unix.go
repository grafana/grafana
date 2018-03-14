// +build linux freebsd netbsd openbsd

package runner

import "os/exec"

const (
	// DefaultChromePath is the default path to the google-chrome executable if
	// a variant cannot be found on $PATH.
	DefaultChromePath = "/usr/bin/google-chrome"
)

// chromeNames are the Chrome executable names to search for in the path.
var chromeNames = []string{
	"google-chrome",
	"chromium-browser",
	"chromium",
	"google-chrome-beta",
	"google-chrome-unstable",
}

func findChromePath() string {
	for _, p := range chromeNames {
		path, err := exec.LookPath(p)
		if err == nil {
			return path
		}
	}

	return DefaultChromePath
}
