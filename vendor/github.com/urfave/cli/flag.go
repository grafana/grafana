package cli

import (
	"flag"
	"fmt"
	"io/ioutil"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"syscall"
)

const defaultPlaceholder = "value"

// BashCompletionFlag enables bash-completion for all commands and subcommands
var BashCompletionFlag Flag = BoolFlag{
	Name:   "generate-bash-completion",
	Hidden: true,
}

// VersionFlag prints the version for the application
var VersionFlag Flag = BoolFlag{
	Name:  "version, v",
	Usage: "print the version",
}

// HelpFlag prints the help for all commands and subcommands
// Set to the zero value (BoolFlag{}) to disable flag -- keeps subcommand
// unless HideHelp is set to true)
var HelpFlag Flag = BoolFlag{
	Name:  "help, h",
	Usage: "show help",
}

// FlagStringer converts a flag definition to a string. This is used by help
// to display a flag.
var FlagStringer FlagStringFunc = stringifyFlag

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
	return lexicographicLess(f[i].GetName(), f[j].GetName())
}

func (f FlagsByName) Swap(i, j int) {
	f[i], f[j] = f[j], f[i]
}

// Flag is a common interface related to parsing flags in cli.
// For more advanced flag parsing techniques, it is recommended that
// this interface be implemented.
type Flag interface {
	fmt.Stringer
	// Apply Flag settings to the given flag set
	Apply(*flag.FlagSet)
	GetName() string
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
}

// errorableFlag is an interface that allows us to return errors during apply
// it allows flags defined in this library to return errors in a fashion backwards compatible
// TODO remove in v2 and modify the existing Flag interface to return errors
type errorableFlag interface {
	Flag

	ApplyWithError(*flag.FlagSet) error
}

func flagSet(name string, flags []Flag) (*flag.FlagSet, error) {
	set := flag.NewFlagSet(name, flag.ContinueOnError)

	for _, f := range flags {
		//TODO remove in v2 when errorableFlag is removed
		if ef, ok := f.(errorableFlag); ok {
			if err := ef.ApplyWithError(set); err != nil {
				return nil, err
			}
		} else {
			f.Apply(set)
		}
	}
	set.SetOutput(ioutil.Discard)
	return set, nil
}

func eachName(longName string, fn func(string)) {
	parts := strings.Split(longName, ",")
	for _, name := range parts {
		name = strings.Trim(name, " ")
		fn(name)
	}
}

func visibleFlags(fl []Flag) []Flag {
	var visible []Flag
	for _, f := range fl {
		field := flagValue(f).FieldByName("Hidden")
		if !field.IsValid() || !field.Bool() {
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

func prefixedNames(fullName, placeholder string) string {
	var prefixed string
	parts := strings.Split(fullName, ",")
	for i, name := range parts {
		name = strings.Trim(name, " ")
		prefixed += prefixFor(name) + name
		if placeholder != "" {
			prefixed += " " + placeholder
		}
		if i < len(parts)-1 {
			prefixed += ", "
		}
	}
	return prefixed
}

func withEnvHint(envVar, str string) string {
	envText := ""
	if envVar != "" {
		prefix := "$"
		suffix := ""
		sep := ", $"
		if runtime.GOOS == "windows" {
			prefix = "%"
			suffix = "%"
			sep = "%, %"
		}
		envText = " [" + prefix + strings.Join(strings.Split(envVar, ","), sep) + suffix + "]"
	}
	return str + envText
}

func withFileHint(filePath, str string) string {
	fileText := ""
	if filePath != "" {
		fileText = fmt.Sprintf(" [%s]", filePath)
	}
	return str + fileText
}

func flagValue(f Flag) reflect.Value {
	fv := reflect.ValueOf(f)
	for fv.Kind() == reflect.Ptr {
		fv = reflect.Indirect(fv)
	}
	return fv
}

func stringifyFlag(f Flag) string {
	fv := flagValue(f)

	switch f.(type) {
	case IntSliceFlag:
		return FlagFileHinter(
			fv.FieldByName("FilePath").String(),
			FlagEnvHinter(
				fv.FieldByName("EnvVar").String(),
				stringifyIntSliceFlag(f.(IntSliceFlag)),
			),
		)
	case Int64SliceFlag:
		return FlagFileHinter(
			fv.FieldByName("FilePath").String(),
			FlagEnvHinter(
				fv.FieldByName("EnvVar").String(),
				stringifyInt64SliceFlag(f.(Int64SliceFlag)),
			),
		)
	case StringSliceFlag:
		return FlagFileHinter(
			fv.FieldByName("FilePath").String(),
			FlagEnvHinter(
				fv.FieldByName("EnvVar").String(),
				stringifyStringSliceFlag(f.(StringSliceFlag)),
			),
		)
	}

	placeholder, usage := unquoteUsage(fv.FieldByName("Usage").String())

	needsPlaceholder := false
	defaultValueString := ""

	if val := fv.FieldByName("Value"); val.IsValid() {
		needsPlaceholder = true
		defaultValueString = fmt.Sprintf(" (default: %v)", val.Interface())

		if val.Kind() == reflect.String && val.String() != "" {
			defaultValueString = fmt.Sprintf(" (default: %q)", val.String())
		}
	}

	if defaultValueString == " (default: )" {
		defaultValueString = ""
	}

	if needsPlaceholder && placeholder == "" {
		placeholder = defaultPlaceholder
	}

	usageWithDefault := strings.TrimSpace(usage + defaultValueString)

	return FlagFileHinter(
		fv.FieldByName("FilePath").String(),
		FlagEnvHinter(
			fv.FieldByName("EnvVar").String(),
			FlagNamePrefixer(fv.FieldByName("Name").String(), placeholder)+"\t"+usageWithDefault,
		),
	)
}

func stringifyIntSliceFlag(f IntSliceFlag) string {
	var defaultVals []string
	if f.Value != nil && len(f.Value.Value()) > 0 {
		for _, i := range f.Value.Value() {
			defaultVals = append(defaultVals, strconv.Itoa(i))
		}
	}

	return stringifySliceFlag(f.Usage, f.Name, defaultVals)
}

func stringifyInt64SliceFlag(f Int64SliceFlag) string {
	var defaultVals []string
	if f.Value != nil && len(f.Value.Value()) > 0 {
		for _, i := range f.Value.Value() {
			defaultVals = append(defaultVals, strconv.FormatInt(i, 10))
		}
	}

	return stringifySliceFlag(f.Usage, f.Name, defaultVals)
}

func stringifyStringSliceFlag(f StringSliceFlag) string {
	var defaultVals []string
	if f.Value != nil && len(f.Value.Value()) > 0 {
		for _, s := range f.Value.Value() {
			if len(s) > 0 {
				defaultVals = append(defaultVals, strconv.Quote(s))
			}
		}
	}

	return stringifySliceFlag(f.Usage, f.Name, defaultVals)
}

func stringifySliceFlag(usage, name string, defaultVals []string) string {
	placeholder, usage := unquoteUsage(usage)
	if placeholder == "" {
		placeholder = defaultPlaceholder
	}

	defaultVal := ""
	if len(defaultVals) > 0 {
		defaultVal = fmt.Sprintf(" (default: %s)", strings.Join(defaultVals, ", "))
	}

	usageWithDefault := strings.TrimSpace(usage + defaultVal)
	return FlagNamePrefixer(name, placeholder) + "\t" + usageWithDefault
}

func flagFromFileEnv(filePath, envName string) (val string, ok bool) {
	for _, envVar := range strings.Split(envName, ",") {
		envVar = strings.TrimSpace(envVar)
		if envVal, ok := syscall.Getenv(envVar); ok {
			return envVal, true
		}
	}
	for _, fileVar := range strings.Split(filePath, ",") {
		if fileVar != "" {
			if data, err := ioutil.ReadFile(fileVar); err == nil {
				return string(data), true
			}
		}
	}
	return "", false
}
