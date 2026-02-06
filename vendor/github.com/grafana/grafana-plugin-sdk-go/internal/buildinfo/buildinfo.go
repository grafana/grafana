package buildinfo

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/build/buildinfo"
)

var (
	buildInfoMode = flag.Bool("buildinfo", false, "print build info and exit")
	versionMode   = flag.Bool("version", false, "print version and exit")
)

// InfoModeEnabled returns true if the plugin should run in build info mode
// (-buildinfo or -version flags provided).
func InfoModeEnabled() bool {
	flag.Parse()
	return *buildInfoMode || *versionMode
}

// RunInfoMode runs the plugin in build info mode, which prints the build info (or just the version) to stdout and returns.
// The caller should call os.Exit right after.
func RunInfoMode() error {
	if !InfoModeEnabled() {
		return errors.New("build info mode not enabled")
	}
	bi, err := buildinfo.GetBuildInfo()
	if err != nil {
		return fmt.Errorf("get build info: %w", err)
	}
	bib, err := json.Marshal(bi)
	if err != nil {
		return fmt.Errorf("marshal build info: %w", err)
	}
	if *versionMode {
		fmt.Println(bi.Version)
	} else {
		fmt.Println(string(bib))
	}
	return nil
}
