package datasource

import (
	"fmt"
	"log"
	"os"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/tracing"
	"github.com/grafana/grafana-plugin-sdk-go/internal/automanagement"
	"github.com/grafana/grafana-plugin-sdk-go/internal/buildinfo"
)

// ManageOpts can modify Manage behavior.
type ManageOpts struct {
	// GRPCSettings settings for gPRC.
	GRPCSettings backend.GRPCSettings

	// TracingOpts contains settings for tracing setup.
	TracingOpts tracing.Opts

	// Stateless admission handler
	AdmissionHandler backend.AdmissionHandler

	// Stateless conversion handler
	ConversionHandler backend.ConversionHandler

	// Stateless query conversion handler
	QueryConversionHandler backend.QueryConversionHandler
}

// Manage starts serving the data source over gPRC with automatic instance management.
// pluginID should match the one from plugin.json.
func Manage(pluginID string, instanceFactory InstanceFactoryFunc, opts ManageOpts) error {
	// If we are running in build info mode, run that and exit
	if buildinfo.InfoModeEnabled() {
		if err := buildinfo.RunInfoMode(); err != nil {
			log.Fatalln(err)
			return err
		}
		os.Exit(0)
		return nil
	}

	backend.SetupPluginEnvironment(pluginID)
	if err := backend.SetupTracer(pluginID, opts.TracingOpts); err != nil {
		return fmt.Errorf("setup tracer: %w", err)
	}
	handler := automanagement.NewManager(NewInstanceManager(instanceFactory))
	return backend.Manage(pluginID, backend.ServeOpts{
		CheckHealthHandler:     handler,
		CallResourceHandler:    handler,
		QueryDataHandler:       handler,
		StreamHandler:          handler,
		QueryConversionHandler: opts.QueryConversionHandler,
		AdmissionHandler:       opts.AdmissionHandler,
		GRPCSettings:           opts.GRPCSettings,
		ConversionHandler:      opts.ConversionHandler,
	})
}
