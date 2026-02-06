package tracerprovider

// PropagatorFormat is an enum-like type representing all the supported OTEL propagator formats.
type PropagatorFormat string

// Supported OTEL propagator formats

const (
	PropagatorFormatJaeger PropagatorFormat = "jaeger"
	PropagatorFormatW3C    PropagatorFormat = "w3c"
)
