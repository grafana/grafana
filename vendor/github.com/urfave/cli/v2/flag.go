package cli

import (
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"regexp"
	"runtime"
	"strings"
	"syscall"
	"time"
)

const defaultPlaceholder = "value"

const (
	defaultSliceFlagSeparator = ","
	disableSliceFlagSeparator = false
)

var (
	slPfx = fmt.Sprintf("sl:::%d:::", time.Now().UTC().UnixNano())

	commaWhitespace = regexp.MustCompile("[, ]+.*")
)

// BashCompletionFlag enables bash-completion for all commands and subcommands
var BashCompletionFlag Flag = &BoolFlag{
	Name:   "generate-bash-completion",
	Hidden: true,
}

// VersionFlag prints the version for the application
var VersionFlag Flag = &BoolFlag{
	Name:               "version",
	Aliases:            []string{"v"},
	Usage:              "print the version",
	DisableDefaultText: true,
}

// HelpFlag prints the help for all commands and subcommands.
// Set to nil to disable the flag.  The subcommand
// will still be added unless HideHelp or HideHelpCommand is set to true.
var HelpFlag Flag = &BoolFlag{
	Name:               "help",
	Aliases:            []string{"h"},
	Usage:              "show help",
	DisableDefaultText: true,
}

// FlagStringer converts a flag definition to a string. This is used by help
// to display a flag.
var FlagStringer FlagStringFunc = stringifyFlag

// Serializer is used to circumvent the limitations of flag.FlagSet.Set
type Serializer interface {
	Serialize() string
}

// FlagNamePrefixer converts a full flag name and its placeholder into the help
// message flag prefix. This is used by the default FlagStringer.
var FlagNamePrefixer FlagNamePrefixFunc = prefixedNames

// FlagEnvHinter annotates flag help message with the environment variable
// details. This is used by the default FlagStringer.
var FlagEnvHinter FlagEnvHintFunc = withEnvHint

// FlagFileHinter annotates flag help message with the environment variable
// details. This is used by the default FlagStringer.
var FlagFileHinter FlagFileHintFunc = withFileHint

// FlagsByName is a slice of Flag.
type FlagsByName []Flag

func (f FlagsByName) Len() int {
	return len(f)
}

func (f FlagsByName) Less(i, j int) bool {
	if len(f[j].Names()) == 0 {
		return false
	} else if len(f[i].Names()) == 0 {
		return true
	}
	return lexicographicLess(f[i].Names()[0], f[j].Names()[0])
}

func (f FlagsByName) Swap(i, j int) {
	f[i], f[j] = f[j], f[i]
}

// ActionableFlag is an interface that wraps Flag interface and RunAction operation.
type ActionableFlag interface {
	Flag
	RunAction(*Context) error
}

// Flag is a common interface related to parsing flags in cli.
// For more advanced flag parsing techniques, it is recommended that
// this interface be implemented.
type Flag interface {
	fmt.Stringer
	// Apply Flag settings to the given flag set
	Apply(*flag.FlagSet) error
	Names() []string
	IsSet() bool
}

// RequiredFlag is an interface that allows us to mark flags as required
// it allows flags required flags to be backwards compatible with the Flag interface
type RequiredFlag interface {
	Flag

	IsRequired() bool
}

// DocGenerationFlag is an interface that allows documentation generation for the flag
type DocGenerationFlag interface {
	Flag

	// TakesValue returns true if the flag takes a value, otherwise false
	TakesValue() bool

	// GetUsage returns the usage string for the flag
	GetUsage() string

	// GetValue returns the flags value as string representation and an empty
	// string if the flag takes no value at all.
	GetValue() string

	// GetDefaultText returns the default text for this flag
	GetDefaultText() string

	// GetEnvVars returns the env vars for this flag
	GetEnvVars() []string
}

// DocGenerationSliceFlag extends DocGenerationFlag for slice-based flags.
type DocGenerationSliceFlag interface {
	DocGenerationFlag

	// IsSliceFlag returns true for flags that can be given multiple times.
	IsSliceFlag() bool
}

// VisibleFlag is an interface that allows to check if a flag is visible
type VisibleFlag interface {
	Flag

	// IsVisible returns true if the flag is not hidden, otherwise false
	IsVisible() bool
}

// CategorizableFlag is an interface that allows us to potentially
// use a flag in a categorized representation.
type CategorizableFlag interface {
	VisibleFlag

	GetCategory() string
}

// Countable is an interface to enable detection of flag values which support
// repetitive flags
type Countable interface {
	Count() int
}

func flagSet(name string, flags []Flag, spec separatorSpec) (*flag.FlagSet, error) {
	set := flag.NewFlagSet(name, flag.ContinueOnError)

	for _, f := range flags {
		if c, ok := f.(customizedSeparator); ok {
			c.WithSeparatorSpec(spec)
		}
		if err := f.Apply(set); err != nil {
			return nil, err
		}
	}
	set.SetOutput(io.Discard)
	return set, nil
}

func copyFlag(name string, ff *flag.Flag, set *flag.FlagSet) {
	switch ff.Value.(type) {
	case Serializer:
		_ = set.Set(name, ff.Value.(Serializer).Serialize())
	default:
		_ = set.Set(name, ff.Value.String())
	}
}

func normalizeFlags(flags []Flag, set *flag.FlagSet) error {
	visited := make(map[string]bool)
	set.Visit(func(f *flag.Flag) {
		visited[f.Name] = true
	})
	for _, f := range flags {
		parts := f.Names()
		if len(parts) == 1 {
			continue
		}
		var ff *flag.Flag
		for _, name := range parts {
			name = strings.Trim(name, " ")
			if visited[name] {
				if ff != nil {
					return errors.New("Cannot use two forms of the same flag: " + name + " " + ff.Name)
				}
				ff = set.Lookup(name)
			}
		}
		if ff == nil {
			continue
		}
		for _, name := range parts {
			name = strings.Trim(name, " ")
			if !visited[name] {
				copyFlag(name, ff, set)
			}
		}
	}
	return nil
}

func visibleFlags(fl []Flag) []Flag {
	var visible []Flag
	for _, f := range fl {
		if vf, ok := f.(VisibleFlag); ok && vf.IsVisible() {
			visible = append(visible, f)
		}
	}
	return visible
}

func prefixFor(name string) (prefix string) {
	if len(name) == 1 {
		prefix = "-"
	} else {
		prefix = "--"
	}

	return
}

// Returns the placeholder, if any, and the unquoted usage string.
func unquoteUsage(usage string) (string, string) {
	for i := 0; i < len(usage); i++ {
		if usage[i] == '`' {
			for j := i + 1; j < len(usage); j++ {
				if usage[j] == '`' {
					name := usage[i+1 : j]
					usage = usage[:i] + name + usage[j+1:]
					return name, usage
				}
			}
			break
		}
	}
	return "", usage
}

func prefixedNames(names []string, placeholder string) string {
	var prefixed string
	for i, name := range names {
		if name == "" {
			continue
		}

		prefixed += prefixFor(name) + name
		if placeholder != "" {
			prefixed += " " + placeholder
		}
		if i < len(names)-1 {
			prefixed += ", "
		}
	}
	return prefixed
}

func envFormat(envVars []string, prefix, sep, suffix string) string {
	if len(envVars) > 0 {
		return fmt.Sprintf(" [%s%s%s]", prefix, strings.Join(envVars, sep), suffix)
	}
	return ""
}

func defaultEnvFormat(envVars []string) string {
	return envFormat(envVars, "$", ", $", "")
}

func withEnvHint(envVars []string, str string) string {
	envText := ""
	if runtime.GOOS != "windows" || os.Getenv("PSHOME") != "" {
		envText = defaultEnvFormat(envVars)
	} else {
		envText = envFormat(envVars, "%", "%, %", "%")
	}
	return str + envText
}

func FlagNames(name string, aliases []string) []string {
	var ret []string

	for _, part := range append([]string{name}, aliases...) {
		// v1 -> v2 migration warning zone:
		// Strip off anything after the first found comma or space, which
		// *hopefully* makes it a tiny bit more obvious that unexpected behavior is
		// caused by using the v1 form of stringly typed "Name".
		ret = append(ret, commaWhitespace.ReplaceAllString(part, ""))
	}

	return ret
}

func withFileHint(filePath, str string) string {
	fileText := ""
	if filePath != "" {
		fileText = fmt.Sprintf(" [%s]", filePath)
	}
	return str + fileText
}

func formatDefault(format string) string {
	return " (default: " + format + ")"
}

func stringifyFlag(f Flag) string {
	// enforce DocGeneration interface on flags to avoid reflection
	df, ok := f.(DocGenerationFlag)
	if !ok {
		return ""
	}

	placeholder, usage := unquoteUsage(df.GetUsage())
	needsPlaceholder := df.TakesValue()

	if needsPlaceholder && placeholder == "" {
		placeholder = defaultPlaceholder
	}

	defaultValueString := ""

	// set default text for all flags except bool flags
	// for bool flags display default text if DisableDefaultText is not
	// set
	if bf, ok := f.(*BoolFlag); !ok || !bf.DisableDefaultText {
		if s := df.GetDefaultText(); s != "" {
			defaultValueString = fmt.Sprintf(formatDefault("%s"), s)
		}
	}

	usageWithDefault := strings.TrimSpace(usage + defaultValueString)

	pn := prefixedNames(df.Names(), placeholder)
	sliceFlag, ok := f.(DocGenerationSliceFlag)
	if ok && sliceFlag.IsSliceFlag() {
		pn = pn + " [ " + pn + " ]"
	}

	return withEnvHint(df.GetEnvVars(), fmt.Sprintf("%s\t%s", pn, usageWithDefault))
}

func hasFlag(flags []Flag, fl Flag) bool {
	for _, existing := range flags {
		if fl == existing {
			return true
		}
	}

	return false
}

// Return the first value from a list of environment variables and files
// (which may or may not exist), a description of where the value was found,
// and a boolean which is true if a value was found.
func flagFromEnvOrFile(envVars []string, filePath string) (value string, fromWhere string, found bool) {
	for _, envVar := range envVars {
		envVar = strings.TrimSpace(envVar)
		if value, found := syscall.Getenv(envVar); found {
			return value, fmt.Sprintf("environment variable %q", envVar), true
		}
	}
	for _, fileVar := range strings.Split(filePath, ",") {
		if fileVar != "" {
			if data, err := os.ReadFile(fileVar); err == nil {
				return string(data), fmt.Sprintf("file %q", filePath), true
			}
		}
	}
	return "", "", false
}

type customizedSeparator interface {
	WithSeparatorSpec(separatorSpec)
}

type separatorSpec struct {
	sep        string
	disabled   bool
	customized bool
}

func (s separatorSpec) flagSplitMultiValues(val string) []string {
	var (
		disabled bool   = s.disabled
		sep      string = s.sep
	)
	if !s.customized {
		disabled = disableSliceFlagSeparator
		sep = defaultSliceFlagSeparator
	}
	if disabled {
		return []string{val}
	}

	return strings.Split(val, sep)
}
