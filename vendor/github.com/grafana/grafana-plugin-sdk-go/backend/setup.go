package backend

import (
	"fmt"
	"net/http"
	"net/http/pprof"
	"os"
)

const (
	// PluginProfilerEnv is a constant for the GF_PLUGINS_PROFILER environment variable used to enable pprof.
	PluginProfilerEnv = "GF_PLUGINS_PROFILER"

	// PluginProfilerPortEnv is a constant for the GF_PLUGINS_PROFILER_PORT environment variable use to specify a pprof port (default 6060).
	PluginProfilerPortEnv = "GF_PLUGINS_PROFILER_PORT"
)

// SetupPluginEnvironment will read the environment variables and apply the
// standard environment behavior.
//
// As the SDK evolves, this will likely change.
//
// Currently this function enables and configures profiling with pprof.
func SetupPluginEnvironment(pluginID string) {
	// Enable profiler
	profilerEnabled := false
	if value, ok := os.LookupEnv(PluginProfilerEnv); ok {
		// compare value to plugin name
		if value == pluginID {
			profilerEnabled = true
		}
	}
	Logger.Info("Profiler", "enabled", profilerEnabled)
	if profilerEnabled {
		profilerPort := "6060"
		if value, ok := os.LookupEnv(PluginProfilerPortEnv); ok {
			profilerPort = value
		}

		Logger.Info("Profiler", "port", profilerPort)
		portConfig := fmt.Sprintf(":%s", profilerPort)

		r := http.NewServeMux()
		r.HandleFunc("/debug/pprof/", pprof.Index)
		r.HandleFunc("/debug/pprof/cmdline", pprof.Cmdline)
		r.HandleFunc("/debug/pprof/profile", pprof.Profile)
		r.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
		r.HandleFunc("/debug/pprof/trace", pprof.Trace)

		go func() {
			if err := http.ListenAndServe(portConfig, r); err != nil {
				Logger.Error("Error Running profiler: %s", err.Error())
			}
		}()
	}
}
