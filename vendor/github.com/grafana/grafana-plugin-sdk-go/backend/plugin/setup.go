package plugin

import (
	"fmt"
	"net/http"
	"net/http/pprof"
	"os"

	hclog "github.com/hashicorp/go-hclog"
)

// SetupPluginEnvironment will read the environment variables and apply the
// standard environment behavior.  As the SDK evolves, this will likely change!
func SetupPluginEnvironment(pluginID string) hclog.Logger {
	pluginLogger := hclog.New(&hclog.LoggerOptions{
		Name: pluginID,
		// TODO: How to make level configurable?
		Level:      hclog.LevelFromString("DEBUG"),
		JSONFormat: true,
		// Color:      hclog.ColorOff, (when we use 0.12)
	})

	// Enable profiler
	profilerEnabled := false
	if value, ok := os.LookupEnv("GF_PLUGINS_PROFILER"); ok {
		// compare value to plugin name
		if value == pluginID {
			profilerEnabled = true
		}
	}
	pluginLogger.Info("Profiler", "enabled", profilerEnabled)
	if profilerEnabled {
		profilerPort := "6060"
		if value, ok := os.LookupEnv("GF_PLUGINS_PROFILER_PORT"); ok {
			profilerPort = value
		}

		pluginLogger.Info("Profiler", "port", profilerPort)
		portConfig := fmt.Sprintf(":%s", profilerPort)

		r := http.NewServeMux()
		r.HandleFunc("/debug/pprof/", pprof.Index)
		r.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
		r.HandleFunc("/debug/pprof/profile", pprof.Profile)
		r.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
		r.HandleFunc("/debug/pprof/trace", pprof.Trace)

		go func() {
			if err := http.ListenAndServe(portConfig, r); err != nil {
				pluginLogger.Error("Error Running profiler: %s", err.Error())
			}
		}()
	}
	return pluginLogger
}
