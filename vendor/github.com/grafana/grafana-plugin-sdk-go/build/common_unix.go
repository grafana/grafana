//go:build !windows

package build

import (
	"fmt"
	"log"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/magefile/mage/mg"
	"github.com/magefile/mage/sh"
	"golang.org/x/sys/unix"
)

// ReloadPlugin - kills any running instances and waits for grafana to reload the plugin
func ReloadPlugin() error {
	exeName, err := getExecutableNameForPlugin(runtime.GOOS, runtime.GOARCH, defaultPluginJSONPath)
	if err != nil {
		return err
	}

	_ = killAllPIDs(exeName)
	_ = sh.RunV("pkill", "dlv")

	// Wait for grafana to start plugin
	for i := 0; i < 20; i++ {
		time.Sleep(250 * time.Millisecond)
		pids := findRunningPIDs(exeName)
		if len(pids) > 1 {
			log.Printf("multiple instances already running")
			break
		}
		if len(pids) > 0 {
			pid := strconv.Itoa(pids[0])
			log.Printf("Running PID: %s", pid)
			break
		}

		log.Printf("waiting for grafana to start: %s...", exeName)
	}
	return nil
}

// Debugger makes a new debug build, re-launches the plugin and attaches the Delve debugger, in headless mode
// listening on port 3222.
//
// The plugin process is killed after re-building, in order to make Grafana launch the new version. Once the new
// version is up, we attach to it with Delve.
func Debugger() error {
	// Debug build
	b := Build{}
	mg.Deps(b.Debug)

	// 1. kill any running instance
	exeName, err := getExecutableName(runtime.GOOS, runtime.GOARCH, defaultPluginJSONPath)
	if err != nil {
		return err
	}
	_ = killAllPIDs(exeName)
	_ = sh.RunV("pkill", "dlv")
	if runtime.GOOS == "linux" {
		if err := checkLinuxPtraceScope(); err != nil {
			return err
		}
	}

	// Wait for grafana to start plugin
	pid := -1
	for i := 0; i < 20; i++ {
		pids := findRunningPIDs(exeName)
		if len(pids) > 1 {
			return fmt.Errorf("multiple instances already running")
		}
		if len(pids) > 0 {
			pid = pids[0]
			log.Printf("Found plugin PID: %d", pid)
			break
		}

		log.Printf("Waiting for Grafana to start plugin: %q...", exeName)
		time.Sleep(250 * time.Millisecond)
	}
	if pid == -1 {
		return fmt.Errorf(
			"could not find plugin process %q, perhaps Grafana is not running?",
			exeName,
		)
	}

	pidStr := strconv.Itoa(pid)
	log.Printf("Attaching Delve to plugin process %d", pid)
	if err := sh.RunV("dlv",
		"attach",
		pidStr,
		"--headless",
		"--listen=:3222",
		"--api-version", "2",
		"--log"); err != nil {
		return err
	}
	log.Printf("Delve finished successfully")

	return nil
}

func killAllPIDs(exeName string) error {
	// TODO: For Windows, use e.g. tasklist /fi "Imagename eq <exe>", and windows.OpenProcess/windows.TerminateProcess
	// to kill found processes
	pids := findRunningPIDs(exeName)
	for _, pid := range pids {
		log.Printf("Killing process: %d", pid)
		err := unix.Kill(pid, 9)
		if err != nil {
			return err
		}
	}
	return nil
}

func findRunningPIDs(exe string) []int {
	pids := []int{}
	out, err := sh.Output("pgrep", "-f", exe)
	if err != nil || out == "" {
		return pids
	}
	for _, txt := range strings.Fields(out) {
		pid, err := strconv.Atoi(txt)
		if err == nil {
			pids = append(pids, pid)
		} else {
			log.Printf("Unable to format %s (%s)", txt, err)
		}
	}
	return pids
}
