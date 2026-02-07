package flagext

import (
	"flag"
	"strings"

	"github.com/go-kit/log"
)

// Registerer is a thing that can RegisterFlags
type Registerer interface {
	RegisterFlags(*flag.FlagSet)
}

// RegistererWithLogger is a thing that can RegisterFlags with a Logger
type RegistererWithLogger interface {
	RegisterFlags(*flag.FlagSet, log.Logger)
}

// RegisterFlags registers flags with the provided Registerers
func RegisterFlags(rs ...Registerer) {
	for _, r := range rs {
		r.RegisterFlags(flag.CommandLine)
	}
}

// RegisterFlagsWithLogger registers flags with the provided Registerers
func RegisterFlagsWithLogger(logger log.Logger, rs ...interface{}) {
	for _, v := range rs {
		switch r := v.(type) {
		case Registerer:
			r.RegisterFlags(flag.CommandLine)
		case RegistererWithLogger:
			r.RegisterFlags(flag.CommandLine, logger)
		default:
			panic("RegisterFlagsWithLogger must be passed a Registerer or RegistererWithLogger")
		}
	}
}

// DefaultValues initiates a set of configs (Registerers) with their defaults.
func DefaultValues(rs ...interface{}) {
	fs := flag.NewFlagSet("", flag.PanicOnError)
	logger := log.NewNopLogger()
	for _, v := range rs {
		switch r := v.(type) {
		case Registerer:
			r.RegisterFlags(fs)
		case RegistererWithLogger:
			r.RegisterFlags(fs, logger)
		default:
			panic("RegisterFlagsWithLogger must be passed a Registerer")
		}
	}
	_ = fs.Parse([]string{})
}

// RegisteredFlagsTracker is an interface that allows to extract RegisteredFlags.
type RegisteredFlagsTracker interface {
	RegisteredFlags() RegisteredFlags
}

// RegisteredFlags contains the flags registered by some config.
type RegisteredFlags struct {
	// Prefix is the prefix used by the flag
	Prefix string
	// Flags are the flag definitions of each one of the flag names. Flag names don't contain the prefix here.
	Flags map[string]*flag.Flag
}

// TrackRegisteredFlags returns the flags that were registered by the register function.
// It only tracks the flags that have the given prefix.
func TrackRegisteredFlags(prefix string, f *flag.FlagSet, register func(prefix string, f *flag.FlagSet)) RegisteredFlags {
	old := map[string]bool{}
	f.VisitAll(func(f *flag.Flag) { old[f.Name] = true })

	register(prefix, f)

	rf := RegisteredFlags{
		Prefix: prefix,
		Flags:  map[string]*flag.Flag{},
	}

	f.VisitAll(func(f *flag.Flag) {
		if !strings.HasPrefix(f.Name, prefix) {
			return
		}
		if !old[f.Name] {
			rf.Flags[f.Name[len(prefix):]] = f
		}
	})

	return rf
}
