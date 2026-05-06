package cli

import (
	"context"
	"fmt"
	"slices"
	"strings"
)

var DefaultInverseBoolPrefix = "no-"

type BoolWithInverseFlag struct {
	Name             string                                      `json:"name"`             // name of the flag
	Category         string                                      `json:"category"`         // category of the flag, if any
	DefaultText      string                                      `json:"defaultText"`      // default text of the flag for usage purposes
	HideDefault      bool                                        `json:"hideDefault"`      // whether to hide the default value in output
	Usage            string                                      `json:"usage"`            // usage string for help output
	Sources          ValueSourceChain                            `json:"-"`                // sources to load flag value from
	Required         bool                                        `json:"required"`         // whether the flag is required or not
	Hidden           bool                                        `json:"hidden"`           // whether to hide the flag in help output
	Local            bool                                        `json:"local"`            // whether the flag needs to be applied to subcommands as well
	Value            bool                                        `json:"defaultValue"`     // default value for this flag if not set by from any source
	Destination      *bool                                       `json:"-"`                // destination pointer for value when set
	Aliases          []string                                    `json:"aliases"`          // Aliases that are allowed for this flag
	TakesFile        bool                                        `json:"takesFileArg"`     // whether this flag takes a file argument, mainly for shell completion purposes
	Action           func(context.Context, *Command, bool) error `json:"-"`                // Action callback to be called when flag is set
	OnlyOnce         bool                                        `json:"onlyOnce"`         // whether this flag can be duplicated on the command line
	Validator        func(bool) error                            `json:"-"`                // custom function to validate this flag value
	ValidateDefaults bool                                        `json:"validateDefaults"` // whether to validate defaults or not
	Config           BoolConfig                                  `json:"config"`           // Additional/Custom configuration associated with this flag type
	InversePrefix    string                                      `json:"invPrefix"`        // The prefix used to indicate a negative value. Default: `env` becomes `no-env`

	// unexported fields for internal use
	count      int   // number of times the flag has been set
	hasBeenSet bool  // whether the flag has been set from env or file
	applied    bool  // whether the flag has been applied to a flag set already
	value      Value // value representing this flag's value
	pset       bool
	nset       bool
}

func (bif *BoolWithInverseFlag) IsSet() bool {
	return bif.hasBeenSet
}

func (bif *BoolWithInverseFlag) Get() any {
	return bif.value.Get()
}

func (bif *BoolWithInverseFlag) RunAction(ctx context.Context, cmd *Command) error {
	if bif.Action != nil {
		return bif.Action(ctx, cmd, bif.Get().(bool))
	}

	return nil
}

func (bif *BoolWithInverseFlag) inversePrefix() string {
	if bif.InversePrefix == "" {
		bif.InversePrefix = DefaultInverseBoolPrefix
	}

	return bif.InversePrefix
}

func (bif *BoolWithInverseFlag) PreParse() error {
	count := bif.Config.Count
	if count == nil {
		count = &bif.count
	}
	dest := bif.Destination
	if dest == nil {
		dest = new(bool)
	}
	bif.value = &boolValue{
		destination: dest,
		count:       count,
	}

	// Validate the given default or values set from external sources as well
	if bif.Validator != nil && bif.ValidateDefaults {
		if err := bif.Validator(bif.value.Get().(bool)); err != nil {
			return err
		}
	}
	bif.applied = true
	return nil
}

func (bif *BoolWithInverseFlag) PostParse() error {
	tracef("postparse (flag=%[1]q)", bif.Name)

	if !bif.hasBeenSet {
		if val, source, found := bif.Sources.LookupWithSource(); found {
			if val == "" {
				val = "false"
			}
			if err := bif.Set(bif.Name, val); err != nil {
				return fmt.Errorf(
					"could not parse %[1]q as %[2]T value from %[3]s for flag %[4]s: %[5]s",
					val, bif.Value, source, bif.Name, err,
				)
			}

			bif.hasBeenSet = true
		}
	}

	return nil
}

func (bif *BoolWithInverseFlag) Set(name, val string) error {
	if bif.count > 0 && bif.OnlyOnce {
		return fmt.Errorf("cant duplicate this flag")
	}

	bif.hasBeenSet = true

	if slices.Contains(append([]string{bif.Name}, bif.Aliases...), name) {
		if bif.nset {
			return fmt.Errorf("cannot set both flags `--%s` and `--%s`", bif.Name, bif.inversePrefix()+bif.Name)
		}
		if err := bif.value.Set(val); err != nil {
			return err
		}
		bif.pset = true
	} else {
		if bif.pset {
			return fmt.Errorf("cannot set both flags `--%s` and `--%s`", bif.Name, bif.inversePrefix()+bif.Name)
		}
		if err := bif.value.Set("false"); err != nil {
			return err
		}
		bif.nset = true
	}

	if bif.Validator != nil {
		return bif.Validator(bif.value.Get().(bool))
	}
	return nil
}

func (bif *BoolWithInverseFlag) Names() []string {
	names := append([]string{bif.Name}, bif.Aliases...)

	for _, name := range names {
		names = append(names, bif.inversePrefix()+name)
	}

	return names
}

// String implements the standard Stringer interface.
//
// Example for BoolFlag{Name: "env"}
// --[no-]env	(default: false)
func (bif *BoolWithInverseFlag) String() string {
	out := FlagStringer(bif)

	i := strings.Index(out, "\t")

	prefix := "--"

	// single character flags are prefixed with `-` instead of `--`
	if len(bif.Name) == 1 {
		prefix = "-"
	}

	return fmt.Sprintf("%s[%s]%s%s", prefix, bif.inversePrefix(), bif.Name, out[i:])
}

// IsBoolFlag returns whether the flag doesnt need to accept args
func (bif *BoolWithInverseFlag) IsBoolFlag() bool {
	return true
}

// Count returns the number of times this flag has been invoked
func (bif *BoolWithInverseFlag) Count() int {
	return bif.count
}

// GetDefaultText returns the default text for this flag
func (bif *BoolWithInverseFlag) GetDefaultText() string {
	if bif.Required {
		return bif.DefaultText
	}
	return boolValue{}.ToString(bif.Value)
}

// GetCategory returns the category of the flag
func (bif *BoolWithInverseFlag) GetCategory() string {
	return bif.Category
}

func (bif *BoolWithInverseFlag) SetCategory(c string) {
	bif.Category = c
}

// GetUsage returns the usage string for the flag
func (bif *BoolWithInverseFlag) GetUsage() string {
	return bif.Usage
}

// GetEnvVars returns the env vars for this flag
func (bif *BoolWithInverseFlag) GetEnvVars() []string {
	return bif.Sources.EnvKeys()
}

// GetValue returns the flags value as string representation and an empty
// string if the flag takes no value at all.
func (bif *BoolWithInverseFlag) GetValue() string {
	return ""
}

func (bif *BoolWithInverseFlag) TakesValue() bool {
	return false
}

// IsDefaultVisible returns true if the flag is not hidden, otherwise false
func (bif *BoolWithInverseFlag) IsDefaultVisible() bool {
	return !bif.HideDefault
}

// TypeName is used for stringify/docs. For bool its a no-op
func (bif *BoolWithInverseFlag) TypeName() string {
	return "bool"
}
