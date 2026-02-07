package otelpyroscope

// Config describes tracer configuration.
// DEPRECATED: Do not use.
type Config struct {
	AppName                   string
	PyroscopeURL              string
	IncludeProfileURL         bool
	IncludeProfileBaselineURL bool
	ProfileBaselineLabels     map[string]string

	RootOnly    bool
	AddSpanName bool
}

// WithRootSpanOnly indicates that only the root span is to be profiled.
// The profile includes samples captured during child span execution
// but the spans won't have their own profiles and won't be annotated
// with pyroscope.profile attributes.
// The option is enabled by default.
// DEPRECATED: Ignored by tracer.
func WithRootSpanOnly(bool) Option { return func(tp *tracerProvider) {} }

// WithAddSpanName specifies whether the current span name should be added
// to the profile labels. N.B if the name is dynamic, or too many values
// are supposed, this may significantly deteriorate performance.
// By default, span name is not added to profile labels.
// DEPRECATED: Ignored by tracer.
func WithAddSpanName(bool) Option { return func(tp *tracerProvider) {} }

// WithAppName specifies the profiled application name.
// It should match the name specified in pyroscope configuration.
// Required, if profile URL or profile baseline URL is enabled.
// DEPRECATED: Ignored by tracer.
func WithAppName(string) Option { return func(tp *tracerProvider) {} }

// WithPyroscopeURL provides a base URL for the profile and baseline URLs.
// Required, if profile URL or profile baseline URL is enabled.
// DEPRECATED: Ignored by tracer.
func WithPyroscopeURL(string) Option { return func(tp *tracerProvider) {} }

// WithProfileURL specifies whether to add the pyroscope.profile.url
// attribute with the URL to the span profile.
// DEPRECATED: Ignored by tracer.
func WithProfileURL(bool) Option { return func(tp *tracerProvider) {} }

// WithProfileBaselineURL specifies whether to add the
// pyroscope.profile.baseline.url attribute with the URL
// to the baseline profile. See WithProfileBaselineLabels.
// DEPRECATED: Ignored by tracer.
func WithProfileBaselineURL(bool) Option { return func(tp *tracerProvider) {} }

// WithProfileBaselineLabels provides a map of extra labels to be added to the
// baseline query alongside with pprof labels set in runtime. Typically,
// it should match the labels specified in the Pyroscope profiler config.
// Note that the map must not be modified.
// DEPRECATED: Ignored by tracer.
func WithProfileBaselineLabels(map[string]string) Option { return func(tp *tracerProvider) {} }

// WithProfileURLBuilder specifies how profile URL is to be built.
// DEPRECATED: Ignored by tracer.
func WithProfileURLBuilder(func(_ string) string) Option { return func(tp *tracerProvider) {} }

// WithDefaultProfileURLBuilder specifies the default profile URL builder.
// DEPRECATED: Ignored by tracer.
func WithDefaultProfileURLBuilder(_, _ string) Option { return func(tp *tracerProvider) {} }
