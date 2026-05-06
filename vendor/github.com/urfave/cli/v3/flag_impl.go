package cli

import (
	"context"
	"flag"
	"fmt"
	"reflect"
	"strings"
)

// Value represents a value as used by cli.
// For now it implements the golang flag.Value interface
type Value interface {
	flag.Value
	flag.Getter
}

type boolFlag interface {
	IsBoolFlag() bool
}

// ValueCreator is responsible for creating a flag.Value emulation
// as well as custom formatting
//
//	T specifies the type
//	C specifies the config for the type
type ValueCreator[T any, C any] interface {
	Create(T, *T, C) Value
	ToString(T) string
}

// NoConfig is for flags which dont need a custom configuration
type NoConfig struct{}

// FlagBase [T,C,VC] is a generic flag base which can be used
// as a boilerplate to implement the most common interfaces
// used by urfave/cli.
//
//	T specifies the type
//	C specifies the configuration required(if any for that flag type)
//	VC specifies the value creator which creates the flag.Value emulation
type FlagBase[T any, C any, VC ValueCreator[T, C]] struct {
	Name             string                                   `json:"name"`             // name of the flag
	Category         string                                   `json:"category"`         // category of the flag, if any
	DefaultText      string                                   `json:"defaultText"`      // default text of the flag for usage purposes
	HideDefault      bool                                     `json:"hideDefault"`      // whether to hide the default value in output
	Usage            string                                   `json:"usage"`            // usage string for help output
	Sources          ValueSourceChain                         `json:"-"`                // sources to load flag value from
	Required         bool                                     `json:"required"`         // whether the flag is required or not
	Hidden           bool                                     `json:"hidden"`           // whether to hide the flag in help output
	Local            bool                                     `json:"local"`            // whether the flag needs to be applied to subcommands as well
	Value            T                                        `json:"defaultValue"`     // default value for this flag if not set by from any source
	Destination      *T                                       `json:"-"`                // destination pointer for value when set
	Aliases          []string                                 `json:"aliases"`          // Aliases that are allowed for this flag
	TakesFile        bool                                     `json:"takesFileArg"`     // whether this flag takes a file argument, mainly for shell completion purposes
	Action           func(context.Context, *Command, T) error `json:"-"`                // Action callback to be called when flag is set
	Config           C                                        `json:"config"`           // Additional/Custom configuration associated with this flag type
	OnlyOnce         bool                                     `json:"onlyOnce"`         // whether this flag can be duplicated on the command line
	Validator        func(T) error                            `json:"-"`                // custom function to validate this flag value
	ValidateDefaults bool                                     `json:"validateDefaults"` // whether to validate defaults or not

	// unexported fields for internal use
	count      int   // number of times the flag has been set
	hasBeenSet bool  // whether the flag has been set from env or file
	applied    bool  // whether the flag has been applied to a flag set already
	creator    VC    // value creator for this flag type
	value      Value // value representing this flag's value
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (f *FlagBase[T, C, V]) GetValue() string {
	if !f.TakesValue() {
		return ""
	}
	return fmt.Sprintf("%v", f.Value)
}

// TypeName returns the type of the flag.
func (f *FlagBase[T, C, V]) TypeName() string {
	ty := reflect.TypeOf(f.Value)
	if ty == nil {
		return ""
	}
	// convert the typename to generic type
	convertToGenericType := func(name string) string {
		prefixMap := map[string]string{
			"float": "float",
			"int":   "int",
			"uint":  "uint",
		}
		for prefix, genericType := range prefixMap {
			if strings.HasPrefix(name, prefix) {
				return genericType
			}
		}
		return strings.ToLower(name)
	}

	switch ty.Kind() {
	// if it is a Slice, then return the slice's inner type. Will nested slices be used in the future?
	case reflect.Slice:
		elemType := ty.Elem()
		return convertToGenericType(elemType.Name())
	// if it is a Map, then return the map's key and value types.
	case reflect.Map:
		keyType := ty.Key()
		valueType := ty.Elem()
		return fmt.Sprintf("%s=%s", convertToGenericType(keyType.Name()), convertToGenericType(valueType.Name()))
	default:
		return convertToGenericType(ty.Name())
	}
}

// PostParse populates the flag given the flag set and environment
func (f *FlagBase[T, C, V]) PostParse() error {
	tracef("postparse (flag=%[1]q)", f.Name)

	if !f.hasBeenSet {
		if val, source, found := f.Sources.LookupWithSource(); found {
			if val != "" || reflect.TypeOf(f.Value).Kind() == reflect.String {
				if err := f.Set(f.Name, val); err != nil {
					return fmt.Errorf(
						"could not parse %[1]q as %[2]T value from %[3]s for flag %[4]s: %[5]s",
						val, f.Value, source, f.Name, err,
					)
				}
			} else if val == "" && reflect.TypeOf(f.Value).Kind() == reflect.Bool {
				_ = f.Set(f.Name, "false")
			}

			f.hasBeenSet = true
		}
	}

	return nil
}

func (f *FlagBase[T, C, V]) PreParse() error {
	newVal := f.Value

	if f.Destination == nil {
		f.value = f.creator.Create(newVal, new(T), f.Config)
	} else {
		f.value = f.creator.Create(newVal, f.Destination, f.Config)
	}

	// Validate the given default or values set from external sources as well
	if f.Validator != nil && f.ValidateDefaults {
		if err := f.Validator(f.value.Get().(T)); err != nil {
			return err
		}
	}
	f.applied = true
	return nil
}

// Set applies given value from string
func (f *FlagBase[T, C, V]) Set(_ string, val string) error {
	tracef("apply (flag=%[1]q)", f.Name)

	// TODO move this phase into a separate flag initialization function
	// if flag has been applied previously then it would have already been set
	// from env or file. So no need to apply the env set again. However
	// lots of units tests prior to persistent flags assumed that the
	// flag can be applied to different flag sets multiple times while still
	// keeping the env set.
	if !f.applied || f.Local {
		if err := f.PreParse(); err != nil {
			return err
		}
		f.applied = true
	}

	if f.count == 1 && f.OnlyOnce {
		return fmt.Errorf("cant duplicate this flag")
	}

	f.count++
	if err := f.value.Set(val); err != nil {
		return err
	}
	f.hasBeenSet = true
	if f.Validator != nil {
		if err := f.Validator(f.value.Get().(T)); err != nil {
			return err
		}
	}
	return nil
}

func (f *FlagBase[T, C, V]) Get() any {
	if f.value != nil {
		return f.value.Get()
	}
	return f.Value
}

// IsDefaultVisible returns true if the flag is not hidden, otherwise false
func (f *FlagBase[T, C, V]) IsDefaultVisible() bool {
	return !f.HideDefault
}

// String returns a readable representation of this value (for usage defaults)
func (f *FlagBase[T, C, V]) String() string {
	return FlagStringer(f)
}

// IsSet returns whether or not the flag has been set through env or file
func (f *FlagBase[T, C, V]) IsSet() bool {
	return f.hasBeenSet
}

// Names returns the names of the flag
func (f *FlagBase[T, C, V]) Names() []string {
	return FlagNames(f.Name, f.Aliases)
}

// IsRequired returns whether or not the flag is required
func (f *FlagBase[T, C, V]) IsRequired() bool {
	return f.Required
}

// IsVisible returns true if the flag is not hidden, otherwise false
func (f *FlagBase[T, C, V]) IsVisible() bool {
	return !f.Hidden
}

// GetCategory returns the category of the flag
func (f *FlagBase[T, C, V]) GetCategory() string {
	return f.Category
}

func (f *FlagBase[T, C, V]) SetCategory(c string) {
	f.Category = c
}

// GetUsage returns the usage string for the flag
func (f *FlagBase[T, C, V]) GetUsage() string {
	return f.Usage
}

// GetEnvVars returns the env vars for this flag
func (f *FlagBase[T, C, V]) GetEnvVars() []string {
	return f.Sources.EnvKeys()
}

// TakesValue returns true if the flag takes a value, otherwise false
func (f *FlagBase[T, C, V]) TakesValue() bool {
	var t T
	return reflect.TypeOf(t) == nil || reflect.TypeOf(t).Kind() != reflect.Bool
}

// GetDefaultText returns the default text for this flag
func (f *FlagBase[T, C, V]) GetDefaultText() string {
	if f.DefaultText != "" {
		return f.DefaultText
	}
	var v V
	return v.ToString(f.Value)
}

// RunAction executes flag action if set
func (f *FlagBase[T, C, V]) RunAction(ctx context.Context, cmd *Command) error {
	if f.Action != nil {
		return f.Action(ctx, cmd, f.value.Get().(T))
	}

	return nil
}

// IsMultiValueFlag returns true if the value type T can take multiple
// values from cmd line. This is true for slice and map type flags
func (f *FlagBase[T, C, VC]) IsMultiValueFlag() bool {
	// TBD how to specify
	if reflect.TypeOf(f.Value) == nil {
		return false
	}
	kind := reflect.TypeOf(f.Value).Kind()
	return kind == reflect.Slice || kind == reflect.Map
}

// IsLocal returns false if flag needs to be persistent across subcommands
func (f *FlagBase[T, C, VC]) IsLocal() bool {
	return f.Local
}

// IsBoolFlag returns whether the flag doesnt need to accept args
func (f *FlagBase[T, C, VC]) IsBoolFlag() bool {
	bf, ok := f.value.(boolFlag)
	return ok && bf.IsBoolFlag()
}

// Count returns the number of times this flag has been invoked
func (f *FlagBase[T, C, VC]) Count() int {
	return f.count
}
