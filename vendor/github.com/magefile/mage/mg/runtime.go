package mg

import (
	"os"
	"path/filepath"
	"runtime"
	"strconv"
)

// CacheEnv is the environment variable that users may set to change the
// location where mage stores its compiled binaries.
const CacheEnv = "MAGEFILE_CACHE"

// VerboseEnv is the environment variable that indicates the user requested
// verbose mode when running a magefile.
const VerboseEnv = "MAGEFILE_VERBOSE"

// DebugEnv is the environment variable that indicates the user requested
// debug mode when running mage.
const DebugEnv = "MAGEFILE_DEBUG"

// GoCmdEnv is the environment variable that indicates the go binary the user
// desires to utilize for Magefile compilation.
const GoCmdEnv = "MAGEFILE_GOCMD"

// IgnoreDefaultEnv is the environment variable that indicates the user requested
// to ignore the default target specified in the magefile.
const IgnoreDefaultEnv = "MAGEFILE_IGNOREDEFAULT"

// HashFastEnv is the environment variable that indicates the user requested to
// use a quick hash of magefiles to determine whether or not the magefile binary
// needs to be rebuilt. This results in faster runtimes, but means that mage
// will fail to rebuild if a dependency has changed. To force a rebuild, run
// mage with the -f flag.
const HashFastEnv = "MAGEFILE_HASHFAST"

// EnableColorEnv is the environment variable that indicates the user is using
// a terminal which supports a color output. The default is false for backwards
// compatibility. When the value is true and the detected terminal does support colors
// then the list of mage targets will be displayed in ANSI color. When the value
// is true but the detected terminal does not support colors, then the list of
// mage targets will be displayed in the default colors (e.g. black and white).
const EnableColorEnv = "MAGEFILE_ENABLE_COLOR"

// TargetColorEnv is the environment variable that indicates which ANSI color
// should be used to colorize mage targets. This is only applicable when
// the MAGEFILE_ENABLE_COLOR environment variable is true.
// The supported ANSI color names are any of these:
// - Black
// - Red
// - Green
// - Yellow
// - Blue
// - Magenta
// - Cyan
// - White
// - BrightBlack
// - BrightRed
// - BrightGreen
// - BrightYellow
// - BrightBlue
// - BrightMagenta
// - BrightCyan
// - BrightWhite
const TargetColorEnv = "MAGEFILE_TARGET_COLOR"

// Verbose reports whether a magefile was run with the verbose flag.
func Verbose() bool {
	b, _ := strconv.ParseBool(os.Getenv(VerboseEnv))
	return b
}

// Debug reports whether a magefile was run with the debug flag.
func Debug() bool {
	b, _ := strconv.ParseBool(os.Getenv(DebugEnv))
	return b
}

// GoCmd reports the command that Mage will use to build go code.  By default mage runs
// the "go" binary in the PATH.
func GoCmd() string {
	if cmd := os.Getenv(GoCmdEnv); cmd != "" {
		return cmd
	}
	return "go"
}

// HashFast reports whether the user has requested to use the fast hashing
// mechanism rather than rely on go's rebuilding mechanism.
func HashFast() bool {
	b, _ := strconv.ParseBool(os.Getenv(HashFastEnv))
	return b
}

// IgnoreDefault reports whether the user has requested to ignore the default target
// in the magefile.
func IgnoreDefault() bool {
	b, _ := strconv.ParseBool(os.Getenv(IgnoreDefaultEnv))
	return b
}

// CacheDir returns the directory where mage caches compiled binaries.  It
// defaults to $HOME/.magefile, but may be overridden by the MAGEFILE_CACHE
// environment variable.
func CacheDir() string {
	d := os.Getenv(CacheEnv)
	if d != "" {
		return d
	}
	switch runtime.GOOS {
	case "windows":
		return filepath.Join(os.Getenv("HOMEDRIVE"), os.Getenv("HOMEPATH"), "magefile")
	default:
		return filepath.Join(os.Getenv("HOME"), ".magefile")
	}
}

// EnableColor reports whether the user has requested to enable a color output.
func EnableColor() bool {
	b, _ := strconv.ParseBool(os.Getenv(EnableColorEnv))
	return b
}

// TargetColor returns the configured ANSI color name a color output.
func TargetColor() string {
	s, exists := os.LookupEnv(TargetColorEnv)
	if exists {
		if c, ok := getAnsiColor(s); ok {
			return c
		}
	}
	return DefaultTargetAnsiColor
}

// Namespace allows for the grouping of similar commands
type Namespace struct{}
