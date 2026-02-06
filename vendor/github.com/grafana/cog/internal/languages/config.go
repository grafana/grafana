package languages

// Config represents global configuration options, to be used by all jennies.
type Config struct {
	// Debug turns on or off the debugging mode.
	Debug bool

	// Types indicates whether types should be generated or not.
	Types bool

	// Builders indicates whether builders should be generated or not.
	Builders bool

	// Converters indicates whether converters should be generated or not.
	Converters bool

	// APIReference indicates whether an API reference should be generated or not.
	APIReference bool
}
