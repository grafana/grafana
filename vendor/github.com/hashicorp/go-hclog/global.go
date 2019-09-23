package hclog

import (
	"sync"
)

var (
	protect sync.Once
	def     Logger

	// The options used to create the Default logger. These are
	// read only when the Default logger is created, so set them
	// as soon as the process starts.
	DefaultOptions = &LoggerOptions{
		Level:  DefaultLevel,
		Output: DefaultOutput,
	}
)

// Return a logger that is held globally. This can be a good starting
// place, and then you can use .With() and .Name() to create sub-loggers
// to be used in more specific contexts.
func Default() Logger {
	protect.Do(func() {
		def = New(DefaultOptions)
	})

	return def
}

// A short alias for Default()
func L() Logger {
	return Default()
}
