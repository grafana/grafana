package datasource

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// ServeOpts options for serving a data source plugin.
//
// Deprecated: ServeOpts exists for historical compatibility
// and might be removed in a future version. Please migrate to use [Manage] instead of [Serve].
type ServeOpts struct {
	// CheckHealthHandler handler for health checks.
	// Optional to implement.
	backend.CheckHealthHandler

	// CallResourceHandler handler for resource calls.
	// Optional to implement.
	backend.CallResourceHandler

	// QueryDataHandler handler for data queries.
	// Required to implement.
	backend.QueryDataHandler

	// StreamHandler for streaming queries.
	backend.StreamHandler

	// AdmissionHandler for processing storage requests
	backend.AdmissionHandler

	// ConversionHandler for converting objects between resource versions
	backend.ConversionHandler

	// GRPCSettings settings for gPRC.
	GRPCSettings backend.GRPCSettings
}

// Serve starts serving the data source over gPRC.
//
// Deprecated: Serve exists for historical compatibility
// and might be removed in a future version. Please migrate to use [Manage] instead.
func Serve(opts ServeOpts) error {
	return backend.Serve(backend.ServeOpts{
		CheckHealthHandler:  opts.CheckHealthHandler,
		CallResourceHandler: opts.CallResourceHandler,
		QueryDataHandler:    opts.QueryDataHandler,
		StreamHandler:       opts.StreamHandler,
		AdmissionHandler:    opts.AdmissionHandler,
		ConversionHandler:   opts.ConversionHandler,
		GRPCSettings:        opts.GRPCSettings,
	})
}
