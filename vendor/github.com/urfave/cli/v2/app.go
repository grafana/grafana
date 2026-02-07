package cli

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const suggestDidYouMeanTemplate = "Did you mean %q?"

var (
	changeLogURL            = "https://github.com/urfave/cli/blob/main/docs/CHANGELOG.md"
	appActionDeprecationURL = fmt.Sprintf("%s#deprecated-cli-app-action-signature", changeLogURL)
	contactSysadmin         = "This is an error in the application.  Please contact the distributor of this application if this is not you."
	errInvalidActionType    = NewExitError("ERROR invalid Action type. "+
		fmt.Sprintf("Must be `func(*Context`)` or `func(*Context) error).  %s", contactSysadmin)+
		fmt.Sprintf("See %s", appActionDeprecationURL), 2)
	ignoreFlagPrefix = "test." // this is to ignore test flags when adding flags from other packages

	SuggestFlag               SuggestFlagFunc    = nil // initialized in suggestions.go unless built with urfave_cli_no_suggest
	SuggestCommand            SuggestCommandFunc = nil // initialized in suggestions.go unless built with urfave_cli_no_suggest
	SuggestDidYouMeanTemplate string             = suggestDidYouMeanTemplate
)

// App is the main structure of a cli application. It is recommended that
// an app be created with the cli.NewApp() function
type App struct {
	// The name of the program. Defaults to path.Base(os.Args[0])
	Name string
	// Full name of command for help, defaults to Name
	HelpName string
	// Description of the program.
	Usage string
	// Text to override the USAGE section of help
	UsageText string
	// Whether this command supports arguments
	Args bool
	// Description of the program argument format.
	ArgsUsage string
	// Version of the program
	Version string
	// Description of the program
	Description string
	// DefaultCommand is the (optional) name of a command
	// to run if no command names are passed as CLI arguments.
	DefaultCommand string
	// List of commands to execute
	Commands []*Command
	// List of flags to parse
	Flags []Flag
	// Boolean to enable bash completion commands
	EnableBashCompletion bool
	// Boolean to hide built-in help command and help flag
	HideHelp bool
	// Boolean to hide built-in help command but keep help flag.
	// Ignored if HideHelp is true.
	HideHelpCommand bool
	// Boolean to hide built-in version flag and the VERSION section of help
	HideVersion bool
	// categories contains the categorized commands and is populated on app startup
	categories CommandCategories
	// flagCategories contains the categorized flags and is populated on app startup
	flagCategories FlagCategories
	// An action to execute when the shell completion flag is set
	BashComplete BashCompleteFunc
	// An action to execute before any subcommands are run, but after the context is ready
	// If a non-nil error is returned, no subcommands are run
	Before BeforeFunc
	// An action to execute after any subcommands are run, but after the subcommand has finished
	// It is run even if Action() panics
	After AfterFunc
	// The action to execute when no subcommands are specified
	Action ActionFunc
	// Execute this function if the proper command cannot be found
	CommandNotFound CommandNotFoundFunc
	// Execute this function if a usage error occurs
	OnUsageError OnUsageErrorFunc
	// Execute this function when an invalid flag is accessed from the context
	InvalidFlagAccessHandler InvalidFlagAccessFunc
	// Compilation date
	Compiled time.Time
	// List of all authors who contributed
	Authors []*Author
	// Copyright of the binary if any
	Copyright string
	// Reader reader to write input to (useful for tests)
	Reader io.Reader
	// Writer writer to write output to
	Writer io.Writer
	// ErrWriter writes error output
	ErrWriter io.Writer
	// ExitErrHandler processes any error encountered while running an App before
	// it is returned to the caller. If no function is provided, HandleExitCoder
	// is used as the default behavior.
	ExitErrHandler ExitErrHandlerFunc
	// Other custom info
	Metadata map[string]interface{}
	// Carries a function which returns app specific info.
	ExtraInfo func() map[string]string
	// CustomAppHelpTemplate the text template for app help topic.
	// cli.go uses text/template to render templates. You can
	// render custom help text by setting this variable.
	CustomAppHelpTemplate string
	// SliceFlagSeparator is used to customize the separator for SliceFlag, the default is ","
	SliceFlagSeparator string
	// DisableSliceFlagSeparator is used to disable SliceFlagSeparator, the default is false
	DisableSliceFlagSeparator bool
	// Boolean to enable short-option handling so user can combine several
	// single-character bool arguments into one
	// i.e. foobar -o -v -> foobar -ov
	UseShortOptionHandling bool
	// Enable suggestions for commands and flags
	Suggest bool
	// Allows global flags set by libraries which use flag.XXXVar(...) directly
	// to be parsed through this library
	AllowExtFlags bool
	// Treat all flags as normal arguments if true
	SkipFlagParsing bool

	didSetup  bool
	separator separatorSpec

	rootCommand *Command
}

type SuggestFlagFunc func(flags []Flag, provided string, hideHelp bool) string

type SuggestCommandFunc func(commands []*Command, provided string) string

// Tries to find out when this binary was compiled.
// Returns the current time if it fails to find it.
func compileTime() time.Time {
	info, err := os.Stat(os.Args[0])
	if err != nil {
		return time.Now()
	}
	return info.ModTime()
}

// NewApp creates a new cli Application with some reasonable defaults for Name,
// Usage, Version and Action.
func NewApp() *App {
	return &App{
		Name:         filepath.Base(os.Args[0]),
		Usage:        "A new cli application",
		UsageText:    "",
		BashComplete: DefaultAppComplete,
		Action:       helpCommand.Action,
		Compiled:     compileTime(),
		Reader:       os.Stdin,
		Writer:       os.Stdout,
		ErrWriter:    os.Stderr,
	}
}

// Setup runs initialization code to ensure all data structures are ready for
// `Run` or inspection prior to `Run`.  It is internally called by `Run`, but
// will return early if setup has already happened.
func (a *App) Setup() {
	if a.didSetup {
		return
	}

	a.didSetup = true

	if a.Name == "" {
		a.Name = filepath.Base(os.Args[0])
	}

	if a.HelpName == "" {
		a.HelpName = a.Name
	}

	if a.Usage == "" {
		a.Usage = "A new cli application"
	}

	if a.Version == "" {
		a.HideVersion = true
	}

	if a.BashComplete == nil {
		a.BashComplete = DefaultAppComplete
	}

	if a.Action == nil {
		a.Action = helpCommand.Action
	}

	if a.Compiled == (time.Time{}) {
		a.Compiled = compileTime()
	}

	if a.Reader == nil {
		a.Reader = os.Stdin
	}

	if a.Writer == nil {
		a.Writer = os.Stdout
	}

	if a.ErrWriter == nil {
		a.ErrWriter = os.Stderr
	}

	if a.AllowExtFlags {
		// add global flags added by other packages
		flag.VisitAll(func(f *flag.Flag) {
			// skip test flags
			if !strings.HasPrefix(f.Name, ignoreFlagPrefix) {
				a.Flags = append(a.Flags, &extFlag{f})
			}
		})
	}

	if len(a.SliceFlagSeparator) != 0 {
		a.separator.customized = true
		a.separator.sep = a.SliceFlagSeparator
	}

	if a.DisableSliceFlagSeparator {
		a.separator.customized = true
		a.separator.disabled = true
	}

	for _, c := range a.Commands {
		cname := c.Name
		if c.HelpName != "" {
			cname = c.HelpName
		}
		c.separator = a.separator
		c.HelpName = fmt.Sprintf("%s %s", a.HelpName, cname)
		c.flagCategories = newFlagCategoriesFromFlags(c.Flags)
	}

	if a.Command(helpCommand.Name) == nil && !a.HideHelp {
		if !a.HideHelpCommand {
			a.appendCommand(helpCommand)
		}

		if HelpFlag != nil {
			a.appendFlag(HelpFlag)
		}
	}

	if !a.HideVersion {
		a.appendFlag(VersionFlag)
	}

	a.categories = newCommandCategories()
	for _, command := range a.Commands {
		a.categories.AddCommand(command.Category, command)
	}
	sort.Sort(a.categories.(*commandCategories))

	a.flagCategories = newFlagCategoriesFromFlags(a.Flags)

	if a.Metadata == nil {
		a.Metadata = make(map[string]interface{})
	}
}

func (a *App) newRootCommand() *Command {
	return &Command{
		Name:                   a.Name,
		Usage:                  a.Usage,
		UsageText:              a.UsageText,
		Description:            a.Description,
		ArgsUsage:              a.ArgsUsage,
		BashComplete:           a.BashComplete,
		Before:                 a.Before,
		After:                  a.After,
		Action:                 a.Action,
		OnUsageError:           a.OnUsageError,
		Subcommands:            a.Commands,
		Flags:                  a.Flags,
		flagCategories:         a.flagCategories,
		HideHelp:               a.HideHelp,
		HideHelpCommand:        a.HideHelpCommand,
		UseShortOptionHandling: a.UseShortOptionHandling,
		HelpName:               a.HelpName,
		CustomHelpTemplate:     a.CustomAppHelpTemplate,
		categories:             a.categories,
		SkipFlagParsing:        a.SkipFlagParsing,
		isRoot:                 true,
		separator:              a.separator,
	}
}

func (a *App) newFlagSet() (*flag.FlagSet, error) {
	return flagSet(a.Name, a.Flags, a.separator)
}

func (a *App) useShortOptionHandling() bool {
	return a.UseShortOptionHandling
}

// Run is the entry point to the cli app. Parses the arguments slice and routes
// to the proper flag/args combination
func (a *App) Run(arguments []string) (err error) {
	return a.RunContext(context.Background(), arguments)
}

// RunContext is like Run except it takes a Context that will be
// passed to its commands and sub-commands. Through this, you can
// propagate timeouts and cancellation requests
func (a *App) RunContext(ctx context.Context, arguments []string) (err error) {
	a.Setup()

	// handle the completion flag separately from the flagset since
	// completion could be attempted after a flag, but before its value was put
	// on the command line. this causes the flagset to interpret the completion
	// flag name as the value of the flag before it which is undesirable
	// note that we can only do this because the shell autocomplete function
	// always appends the completion flag at the end of the command
	shellComplete, arguments := checkShellCompleteFlag(a, arguments)

	cCtx := NewContext(a, nil, &Context{Context: ctx})
	cCtx.shellComplete = shellComplete

	a.rootCommand = a.newRootCommand()
	cCtx.Command = a.rootCommand

	if err := checkDuplicatedCmds(a.rootCommand); err != nil {
		return err
	}
	return a.rootCommand.Run(cCtx, arguments...)
}

// RunAsSubcommand is for legacy/compatibility purposes only. New code should only
// use App.RunContext. This function is slated to be removed in v3.
func (a *App) RunAsSubcommand(ctx *Context) (err error) {
	a.Setup()

	cCtx := NewContext(a, nil, ctx)
	cCtx.shellComplete = ctx.shellComplete

	a.rootCommand = a.newRootCommand()
	cCtx.Command = a.rootCommand

	return a.rootCommand.Run(cCtx, ctx.Args().Slice()...)
}

func (a *App) suggestFlagFromError(err error, command string) (string, error) {
	flag, parseErr := flagFromError(err)
	if parseErr != nil {
		return "", err
	}

	flags := a.Flags
	hideHelp := a.HideHelp
	if command != "" {
		cmd := a.Command(command)
		if cmd == nil {
			return "", err
		}
		flags = cmd.Flags
		hideHelp = hideHelp || cmd.HideHelp
	}

	if SuggestFlag == nil {
		return "", err
	}
	suggestion := SuggestFlag(flags, flag, hideHelp)
	if len(suggestion) == 0 {
		return "", err
	}

	return fmt.Sprintf(SuggestDidYouMeanTemplate+"\n\n", suggestion), nil
}

// RunAndExitOnError calls .Run() and exits non-zero if an error was returned
//
// Deprecated: instead you should return an error that fulfills cli.ExitCoder
// to cli.App.Run. This will cause the application to exit with the given error
// code in the cli.ExitCoder
func (a *App) RunAndExitOnError() {
	if err := a.Run(os.Args); err != nil {
		_, _ = fmt.Fprintln(a.ErrWriter, err)
		OsExiter(1)
	}
}

// Command returns the named command on App. Returns nil if the command does not exist
func (a *App) Command(name string) *Command {
	for _, c := range a.Commands {
		if c.HasName(name) {
			return c
		}
	}

	return nil
}

// VisibleCategories returns a slice of categories and commands that are
// Hidden=false
func (a *App) VisibleCategories() []CommandCategory {
	ret := []CommandCategory{}
	for _, category := range a.categories.Categories() {
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
func (a *App) VisibleCommands() []*Command {
	var ret []*Command
	for _, command := range a.Commands {
		if !command.Hidden {
			ret = append(ret, command)
		}
	}
	return ret
}

// VisibleFlagCategories returns a slice containing all the categories with the flags they contain
func (a *App) VisibleFlagCategories() []VisibleFlagCategory {
	if a.flagCategories == nil {
		return []VisibleFlagCategory{}
	}
	return a.flagCategories.VisibleCategories()
}

// VisibleFlags returns a slice of the Flags with Hidden=false
func (a *App) VisibleFlags() []Flag {
	return visibleFlags(a.Flags)
}

func (a *App) appendFlag(fl Flag) {
	if !hasFlag(a.Flags, fl) {
		a.Flags = append(a.Flags, fl)
	}
}

func (a *App) appendCommand(c *Command) {
	if !hasCommand(a.Commands, c) {
		a.Commands = append(a.Commands, c)
	}
}

func (a *App) handleExitCoder(cCtx *Context, err error) {
	if a.ExitErrHandler != nil {
		a.ExitErrHandler(cCtx, err)
	} else {
		HandleExitCoder(err)
	}
}

func (a *App) argsWithDefaultCommand(oldArgs Args) Args {
	if a.DefaultCommand != "" {
		rawArgs := append([]string{a.DefaultCommand}, oldArgs.Slice()...)
		newArgs := args(rawArgs)

		return &newArgs
	}

	return oldArgs
}

func runFlagActions(c *Context, fs []Flag) error {
	for _, f := range fs {
		isSet := false
		for _, name := range f.Names() {
			if c.IsSet(name) {
				isSet = true
				break
			}
		}
		if isSet {
			if af, ok := f.(ActionableFlag); ok {
				if err := af.RunAction(c); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

// Author represents someone who has contributed to a cli project.
type Author struct {
	Name  string // The Authors name
	Email string // The Authors email
}

// String makes Author comply to the Stringer interface, to allow an easy print in the templating process
func (a *Author) String() string {
	e := ""
	if a.Email != "" {
		e = " <" + a.Email + ">"
	}

	return fmt.Sprintf("%v%v", a.Name, e)
}

// HandleAction attempts to figure out which Action signature was used.  If
// it's an ActionFunc or a func with the legacy signature for Action, the func
// is run!
func HandleAction(action interface{}, cCtx *Context) (err error) {
	switch a := action.(type) {
	case ActionFunc:
		return a(cCtx)
	case func(*Context) error:
		return a(cCtx)
	case func(*Context): // deprecated function signature
		a(cCtx)
		return nil
	}

	return errInvalidActionType
}

func checkStringSliceIncludes(want string, sSlice []string) bool {
	found := false
	for _, s := range sSlice {
		if want == s {
			found = true
			break
		}
	}

	return found
}
