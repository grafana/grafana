package cli

import (
	"context"
	"fmt"
	"io"
	"slices"
	"strings"
)

const (
	// ignoreFlagPrefix is to ignore test flags when adding flags from other packages
	ignoreFlagPrefix = "test."

	commandContextKey = contextKey("cli.context")
)

type contextKey string

// Command contains everything needed to run an application that
// accepts a string slice of arguments such as os.Args. A given
// Command may contain Flags and sub-commands in Commands.
type Command struct {
	// The name of the command
	Name string `json:"name"`
	// A list of aliases for the command
	Aliases []string `json:"aliases"`
	// A short description of the usage of this command
	Usage string `json:"usage"`
	// Text to override the USAGE section of help
	UsageText string `json:"usageText"`
	// A short description of the arguments of this command
	ArgsUsage string `json:"argsUsage"`
	// Version of the command
	Version string `json:"version"`
	// Longer explanation of how the command works
	Description string `json:"description"`
	// DefaultCommand is the (optional) name of a command
	// to run if no command names are passed as CLI arguments.
	DefaultCommand string `json:"defaultCommand"`
	// The category the command is part of
	Category string `json:"category"`
	// List of child commands
	Commands []*Command `json:"commands"`
	// List of flags to parse
	Flags []Flag `json:"flags"`
	// Boolean to hide built-in help command and help flag
	HideHelp bool `json:"hideHelp"`
	// Ignored if HideHelp is true.
	HideHelpCommand bool `json:"hideHelpCommand"`
	// Boolean to hide built-in version flag and the VERSION section of help
	HideVersion bool `json:"hideVersion"`
	// Boolean to enable shell completion commands
	EnableShellCompletion bool `json:"-"`
	// Shell Completion generation command name
	ShellCompletionCommandName string `json:"-"`
	// The function to call when checking for shell command completions
	ShellComplete ShellCompleteFunc `json:"-"`
	// The function to configure a shell completion command
	ConfigureShellCompletionCommand ConfigureShellCompletionCommand `json:"-"`
	// An action to execute before any subcommands are run, but after the context is ready
	// If a non-nil error is returned, no subcommands are run
	Before BeforeFunc `json:"-"`
	// An action to execute after any subcommands are run, but after the subcommand has finished
	// It is run even if Action() panics
	After AfterFunc `json:"-"`
	// The function to call when this command is invoked
	Action ActionFunc `json:"-"`
	// Execute this function if the proper command cannot be found
	CommandNotFound CommandNotFoundFunc `json:"-"`
	// Execute this function if a usage error occurs.
	OnUsageError OnUsageErrorFunc `json:"-"`
	// Execute this function when an invalid flag is accessed from the context
	InvalidFlagAccessHandler InvalidFlagAccessFunc `json:"-"`
	// Boolean to hide this command from help or completion
	Hidden bool `json:"hidden"`
	// List of all authors who contributed (string or fmt.Stringer)
	// TODO: ~string | fmt.Stringer when interface unions are available
	Authors []any `json:"authors"`
	// Copyright of the binary if any
	Copyright string `json:"copyright"`
	// Reader reader to write input to (useful for tests)
	Reader io.Reader `json:"-"`
	// Writer writer to write output to
	Writer io.Writer `json:"-"`
	// ErrWriter writes error output
	ErrWriter io.Writer `json:"-"`
	// ExitErrHandler processes any error encountered while running an App before
	// it is returned to the caller. If no function is provided, HandleExitCoder
	// is used as the default behavior.
	ExitErrHandler ExitErrHandlerFunc `json:"-"`
	// Other custom info
	Metadata map[string]interface{} `json:"metadata"`
	// Carries a function which returns app specific info.
	ExtraInfo func() map[string]string `json:"-"`
	// CustomRootCommandHelpTemplate the text template for app help topic.
	// cli.go uses text/template to render templates. You can
	// render custom help text by setting this variable.
	CustomRootCommandHelpTemplate string `json:"-"`
	// SliceFlagSeparator is used to customize the separator for SliceFlag, the default is ","
	SliceFlagSeparator string `json:"sliceFlagSeparator"`
	// DisableSliceFlagSeparator is used to disable SliceFlagSeparator, the default is false
	DisableSliceFlagSeparator bool `json:"disableSliceFlagSeparator"`
	// Boolean to enable short-option handling so user can combine several
	// single-character bool arguments into one
	// i.e. foobar -o -v -> foobar -ov
	UseShortOptionHandling bool `json:"useShortOptionHandling"`
	// Enable suggestions for commands and flags
	Suggest bool `json:"suggest"`
	// Allows global flags set by libraries which use flag.XXXVar(...) directly
	// to be parsed through this library
	AllowExtFlags bool `json:"allowExtFlags"`
	// Treat all flags as normal arguments if true
	SkipFlagParsing bool `json:"skipFlagParsing"`
	// CustomHelpTemplate the text template for the command help topic.
	// cli.go uses text/template to render templates. You can
	// render custom help text by setting this variable.
	CustomHelpTemplate string `json:"-"`
	// Use longest prefix match for commands
	PrefixMatchCommands bool `json:"prefixMatchCommands"`
	// Custom suggest command for matching
	SuggestCommandFunc SuggestCommandFunc `json:"-"`
	// Flag exclusion group
	MutuallyExclusiveFlags []MutuallyExclusiveFlags `json:"mutuallyExclusiveFlags"`
	// Arguments to parse for this command
	Arguments []Argument `json:"arguments"`
	// Whether to read arguments from stdin
	// applicable to root command only
	ReadArgsFromStdin bool `json:"readArgsFromStdin"`

	// categories contains the categorized commands and is populated on app startup
	categories CommandCategories
	// flagCategories contains the categorized flags and is populated on app startup
	flagCategories FlagCategories
	// flags that have been applied in current parse
	appliedFlags []Flag
	// flags that have been set
	setFlags map[Flag]struct{}
	// The parent of this command. This value will be nil for the
	// command at the root of the graph.
	parent *Command
	// parsed args
	parsedArgs Args
	// track state of error handling
	isInError bool
	// track state of defaults
	didSetupDefaults bool
	// whether in shell completion mode
	shellCompletion bool
}

// FullName returns the full name of the command.
// For commands with parents this ensures that the parent commands
// are part of the command path.
func (cmd *Command) FullName() string {
	namePath := []string{}

	if cmd.parent != nil {
		namePath = append(namePath, cmd.parent.FullName())
	}

	return strings.Join(append(namePath, cmd.Name), " ")
}

func (cmd *Command) Command(name string) *Command {
	for _, subCmd := range cmd.Commands {
		if subCmd.HasName(name) {
			return subCmd
		}
	}

	return nil
}

func (cmd *Command) checkHelp() bool {
	tracef("checking if help is wanted (cmd=%[1]q)", cmd.Name)

	return HelpFlag != nil && slices.ContainsFunc(HelpFlag.Names(), cmd.Bool)
}

func (cmd *Command) allFlags() []Flag {
	var flags []Flag
	flags = append(flags, cmd.Flags...)
	for _, grpf := range cmd.MutuallyExclusiveFlags {
		for _, f1 := range grpf.Flags {
			flags = append(flags, f1...)
		}
	}
	return flags
}

// useShortOptionHandling traverses Lineage() for *any* ancestors
// with UseShortOptionHandling
func (cmd *Command) useShortOptionHandling() bool {
	for _, pCmd := range cmd.Lineage() {
		if pCmd.UseShortOptionHandling {
			return true
		}
	}

	return false
}

func (cmd *Command) suggestFlagFromError(err error, commandName string) (string, error) {
	fl, parseErr := flagFromError(err)
	if parseErr != nil {
		return "", err
	}

	flags := cmd.Flags
	hideHelp := cmd.hideHelp()

	if commandName != "" {
		subCmd := cmd.Command(commandName)
		if subCmd == nil {
			return "", err
		}
		flags = subCmd.Flags
		hideHelp = hideHelp || subCmd.HideHelp
	}

	suggestion := SuggestFlag(flags, fl, hideHelp)
	if len(suggestion) == 0 {
		return "", err
	}

	return fmt.Sprintf(SuggestDidYouMeanTemplate, suggestion) + "\n\n", nil
}

// Names returns the names including short names and aliases.
func (cmd *Command) Names() []string {
	return append([]string{cmd.Name}, cmd.Aliases...)
}

// HasName returns true if Command.Name matches given name
func (cmd *Command) HasName(name string) bool {
	return slices.Contains(cmd.Names(), name)
}

// VisibleCategories returns a slice of categories and commands that are
// Hidden=false
func (cmd *Command) VisibleCategories() []CommandCategory {
	ret := []CommandCategory{}
	for _, category := range cmd.categories.Categories() {
		if visible := func() CommandCategory {
			if len(category.VisibleCommands()) > 0 {
				return category
			}
			return nil
		}(); visible != nil {
			ret = append(ret, visible)
		}
	}
	return ret
}

// VisibleCommands returns a slice of the Commands with Hidden=false
func (cmd *Command) VisibleCommands() []*Command {
	var ret []*Command
	for _, command := range cmd.Commands {
		if command.Hidden || command.Name == helpName {
			continue
		}
		ret = append(ret, command)
	}
	return ret
}

// VisibleFlagCategories returns a slice containing all the visible flag categories with the flags they contain
func (cmd *Command) VisibleFlagCategories() []VisibleFlagCategory {
	if cmd.flagCategories == nil {
		cmd.flagCategories = newFlagCategoriesFromFlags(cmd.allFlags())
	}
	return cmd.flagCategories.VisibleCategories()
}

// VisibleFlags returns a slice of the Flags with Hidden=false
func (cmd *Command) VisibleFlags() []Flag {
	return visibleFlags(cmd.allFlags())
}

func (cmd *Command) appendFlag(fl Flag) {
	if !hasFlag(cmd.Flags, fl) {
		cmd.Flags = append(cmd.Flags, fl)
	}
}

// VisiblePersistentFlags returns a slice of [LocalFlag] with Persistent=true and Hidden=false.
func (cmd *Command) VisiblePersistentFlags() []Flag {
	var flags []Flag
	for _, fl := range cmd.Root().Flags {
		pfl, ok := fl.(LocalFlag)
		if !ok || pfl.IsLocal() {
			continue
		}
		flags = append(flags, fl)
	}
	return visibleFlags(flags)
}

func (cmd *Command) appendCommand(aCmd *Command) {
	if !slices.Contains(cmd.Commands, aCmd) {
		aCmd.parent = cmd
		cmd.Commands = append(cmd.Commands, aCmd)
	}
}

func (cmd *Command) handleExitCoder(ctx context.Context, err error) error {
	if cmd.parent != nil {
		return cmd.parent.handleExitCoder(ctx, err)
	}

	if cmd.ExitErrHandler != nil {
		cmd.ExitErrHandler(ctx, cmd, err)
		return err
	}

	HandleExitCoder(err)
	return err
}

func (cmd *Command) argsWithDefaultCommand(oldArgs Args) Args {
	if cmd.DefaultCommand != "" {
		rawArgs := append([]string{cmd.DefaultCommand}, oldArgs.Slice()...)
		newArgs := &stringSliceArgs{v: rawArgs}

		return newArgs
	}

	return oldArgs
}

// Root returns the Command at the root of the graph
func (cmd *Command) Root() *Command {
	if cmd.parent == nil {
		return cmd
	}

	return cmd.parent.Root()
}

func (cmd *Command) set(fName string, f Flag, val string) error {
	cmd.setFlags[f] = struct{}{}
	if err := f.Set(fName, val); err != nil {
		return fmt.Errorf("invalid value %q for flag -%s: %v", val, fName, err)
	}
	return nil
}

func (cmd *Command) lFlag(name string) Flag {
	for _, f := range cmd.allFlags() {
		if slices.Contains(f.Names(), name) {
			tracef("flag found for name %[1]q (cmd=%[2]q)", name, cmd.Name)
			return f
		}
	}
	return nil
}

func (cmd *Command) lookupFlag(name string) Flag {
	for _, pCmd := range cmd.Lineage() {
		if f := pCmd.lFlag(name); f != nil {
			return f
		}
	}

	tracef("flag NOT found for name %[1]q (cmd=%[2]q)", name, cmd.Name)
	cmd.onInvalidFlag(context.TODO(), name)
	return nil
}

func (cmd *Command) checkRequiredFlag(f Flag) (bool, string) {
	if rf, ok := f.(RequiredFlag); ok && rf.IsRequired() {
		flagName := f.Names()[0]
		if !f.IsSet() {
			return false, flagName
		}
	}
	return true, ""
}

func (cmd *Command) checkAllRequiredFlags() requiredFlagsErr {
	for pCmd := cmd; pCmd != nil; pCmd = pCmd.parent {
		if err := pCmd.checkRequiredFlags(); err != nil {
			return err
		}
	}
	return nil
}

func (cmd *Command) checkRequiredFlags() requiredFlagsErr {
	tracef("checking for required flags (cmd=%[1]q)", cmd.Name)

	missingFlags := []string{}

	for _, f := range cmd.appliedFlags {
		if ok, name := cmd.checkRequiredFlag(f); !ok {
			missingFlags = append(missingFlags, name)
		}
	}

	if len(missingFlags) != 0 {
		tracef("found missing required flags %[1]q (cmd=%[2]q)", missingFlags, cmd.Name)

		return &errRequiredFlags{missingFlags: missingFlags}
	}

	tracef("all required flags set (cmd=%[1]q)", cmd.Name)

	return nil
}

func (cmd *Command) onInvalidFlag(ctx context.Context, name string) {
	for cmd != nil {
		if cmd.InvalidFlagAccessHandler != nil {
			cmd.InvalidFlagAccessHandler(ctx, cmd, name)
			break
		}
		cmd = cmd.parent
	}
}

// NumFlags returns the number of flags set
func (cmd *Command) NumFlags() int {
	tracef("numFlags numAppliedFlags %d", len(cmd.appliedFlags))
	count := 0
	for _, f := range cmd.appliedFlags {
		if f.IsSet() {
			count++
		}
	}
	return count // cmd.flagSet.NFlag()
}

// Set sets a context flag to a value.
func (cmd *Command) Set(name, value string) error {
	if f := cmd.lookupFlag(name); f != nil {
		return f.Set(name, value)
	}

	return fmt.Errorf("no such flag -%s", name)
}

// IsSet determines if the flag was actually set
func (cmd *Command) IsSet(name string) bool {
	fl := cmd.lookupFlag(name)
	if fl == nil {
		tracef("flag with name %[1]q NOT found; assuming not set (cmd=%[2]q)", name, cmd.Name)
		return false
	}

	isSet := fl.IsSet()
	if isSet {
		tracef("flag with name %[1]q is set (cmd=%[2]q)", name, cmd.Name)
	} else {
		tracef("flag with name %[1]q is no set (cmd=%[2]q)", name, cmd.Name)
	}

	return isSet
}

// LocalFlagNames returns a slice of flag names used in this
// command.
func (cmd *Command) LocalFlagNames() []string {
	names := []string{}

	// Check the flags which have been set via env or file
	for _, f := range cmd.allFlags() {
		if f.IsSet() {
			names = append(names, f.Names()...)
		}
	}

	// Sort out the duplicates since flag could be set via multiple
	// paths
	m := map[string]struct{}{}
	uniqNames := []string{}

	for _, name := range names {
		if _, ok := m[name]; !ok {
			m[name] = struct{}{}
			uniqNames = append(uniqNames, name)
		}
	}

	return uniqNames
}

// FlagNames returns a slice of flag names used by the this command
// and all of its parent commands.
func (cmd *Command) FlagNames() []string {
	names := cmd.LocalFlagNames()

	if cmd.parent != nil {
		names = append(cmd.parent.FlagNames(), names...)
	}

	return names
}

// Lineage returns *this* command and all of its ancestor commands
// in order from child to parent
func (cmd *Command) Lineage() []*Command {
	lineage := []*Command{cmd}

	if cmd.parent != nil {
		lineage = append(lineage, cmd.parent.Lineage()...)
	}

	return lineage
}

// Count returns the num of occurrences of this flag
func (cmd *Command) Count(name string) int {
	if cf, ok := cmd.lookupFlag(name).(Countable); ok {
		return cf.Count()
	}
	return 0
}

// Value returns the value of the flag corresponding to `name`
func (cmd *Command) Value(name string) interface{} {
	if fs := cmd.lookupFlag(name); fs != nil {
		tracef("value found for name %[1]q (cmd=%[2]q)", name, cmd.Name)
		return fs.Get()
	}

	tracef("value NOT found for name %[1]q (cmd=%[2]q)", name, cmd.Name)
	return nil
}

// Args returns the command line arguments associated with the
// command.
func (cmd *Command) Args() Args {
	return cmd.parsedArgs
}

// NArg returns the number of the command line arguments.
func (cmd *Command) NArg() int {
	return cmd.Args().Len()
}

func (cmd *Command) runFlagActions(ctx context.Context) error {
	tracef("runFlagActions")
	for fl := range cmd.setFlags {
		/*tracef("checking %v:%v", fl.Names(), fl.IsSet())
		if !fl.IsSet() {
			continue
		}*/

		//if pf, ok := fl.(LocalFlag); ok && !pf.IsLocal() {
		//	continue
		//}

		if af, ok := fl.(ActionableFlag); ok {
			if err := af.RunAction(ctx, cmd); err != nil {
				return err
			}
		}
	}

	return nil
}
