package cli

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"time"
)

var (
	changeLogURL            = "https://github.com/urfave/cli/blob/master/docs/CHANGELOG.md"
	appActionDeprecationURL = fmt.Sprintf("%s#deprecated-cli-app-action-signature", changeLogURL)
	contactSysadmin         = "This is an error in the application.  Please contact the distributor of this application if this is not you."
	errInvalidActionType    = NewExitError("ERROR invalid Action type. "+
		fmt.Sprintf("Must be `func(*Context`)` or `func(*Context) error).  %s", contactSysadmin)+
		fmt.Sprintf("See %s", appActionDeprecationURL), 2)
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
	// Description of the program argument format.
	ArgsUsage string
	// Version of the program
	Version string
	// Description of the program
	Description string
	// List of commands to execute
	Commands []*Command
	// List of flags to parse
	Flags []Flag
	// Boolean to enable bash completion commands
	EnableBashCompletion bool
	// Boolean to hide built-in help command
	HideHelp bool
	// Boolean to hide built-in version flag and the VERSION section of help
	HideVersion bool
	// categories contains the categorized commands and is populated on app startup
	categories CommandCategories
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
	// Execute this function if an usage error occurs
	OnUsageError OnUsageErrorFunc
	// Compilation date
	Compiled time.Time
	// List of all authors who contributed
	Authors []*Author
	// Copyright of the binary if any
	Copyright string
	// Writer writer to write output to
	Writer io.Writer
	// ErrWriter writes error output
	ErrWriter io.Writer
	// Execute this function to handle ExitErrors. If not provided, HandleExitCoder is provided to
	// function as a default, so this is optional.
	ExitErrHandler ExitErrHandlerFunc
	// Other custom info
	Metadata map[string]interface{}
	// Carries a function which returns app specific info.
	ExtraInfo func() map[string]string
	// CustomAppHelpTemplate the text template for app help topic.
	// cli.go uses text/template to render templates. You can
	// render custom help text by setting this variable.
	CustomAppHelpTemplate string
	// Boolean to enable short-option handling so user can combine several
	// single-character bool arguments into one
	// i.e. foobar -o -v -> foobar -ov
	UseShortOptionHandling bool

	didSetup bool
}

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
		HelpName:     filepath.Base(os.Args[0]),
		Usage:        "A new cli application",
		UsageText:    "",
		BashComplete: DefaultAppComplete,
		Action:       helpCommand.Action,
		Compiled:     compileTime(),
		Writer:       os.Stdout,
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
		a.HelpName = filepath.Base(os.Args[0])
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

	if a.Writer == nil {
		a.Writer = os.Stdout
	}

	var newCommands []*Command

	for _, c := range a.Commands {
		if c.HelpName == "" {
			c.HelpName = fmt.Sprintf("%s %s", a.HelpName, c.Name)
		}
		newCommands = append(newCommands, c)
	}
	a.Commands = newCommands

	if a.Command(helpCommand.Name) == nil && !a.HideHelp {
		a.appendCommand(helpCommand)

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

	if a.Metadata == nil {
		a.Metadata = make(map[string]interface{})
	}

	if a.Writer == nil {
		a.Writer = os.Stdout
	}
}

func (a *App) newFlagSet() (*flag.FlagSet, error) {
	return flagSet(a.Name, a.Flags)
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

	set, err := a.newFlagSet()
	if err != nil {
		return err
	}

	err = parseIter(set, a, arguments[1:], shellComplete)
	nerr := normalizeFlags(a.Flags, set)
	context := NewContext(a, set, &Context{Context: ctx})
	if nerr != nil {
		_, _ = fmt.Fprintln(a.Writer, nerr)
		_ = ShowAppHelp(context)
		return nerr
	}
	context.shellComplete = shellComplete

	if checkCompletions(context) {
		return nil
	}

	if err != nil {
		if a.OnUsageError != nil {
			err := a.OnUsageError(context, err, false)
			a.handleExitCoder(context, err)
			return err
		}
		_, _ = fmt.Fprintf(a.Writer, "%s %s\n\n", "Incorrect Usage.", err.Error())
		_ = ShowAppHelp(context)
		return err
	}

	if !a.HideHelp && checkHelp(context) {
		_ = ShowAppHelp(context)
		return nil
	}

	if !a.HideVersion && checkVersion(context) {
		ShowVersion(context)
		return nil
	}

	cerr := checkRequiredFlags(a.Flags, context)
	if cerr != nil {
		_ = ShowAppHelp(context)
		return cerr
	}

	if a.After != nil {
		defer func() {
			if afterErr := a.After(context); afterErr != nil {
				if err != nil {
					err = newMultiError(err, afterErr)
				} else {
					err = afterErr
				}
			}
		}()
	}

	if a.Before != nil {
		beforeErr := a.Before(context)
		if beforeErr != nil {
			_, _ = fmt.Fprintf(a.Writer, "%v\n\n", beforeErr)
			_ = ShowAppHelp(context)
			a.handleExitCoder(context, beforeErr)
			err = beforeErr
			return err
		}
	}

	args := context.Args()
	if args.Present() {
		name := args.First()
		c := a.Command(name)
		if c != nil {
			return c.Run(context)
		}
	}

	if a.Action == nil {
		a.Action = helpCommand.Action
	}

	// Run default Action
	err = a.Action(context)

	a.handleExitCoder(context, err)
	return err
}

// RunAndExitOnError calls .Run() and exits non-zero if an error was returned
//
// Deprecated: instead you should return an error that fulfills cli.ExitCoder
// to cli.App.Run. This will cause the application to exit with the given eror
// code in the cli.ExitCoder
func (a *App) RunAndExitOnError() {
	if err := a.Run(os.Args); err != nil {
		_, _ = fmt.Fprintln(a.errWriter(), err)
		OsExiter(1)
	}
}

// RunAsSubcommand invokes the subcommand given the context, parses ctx.Args() to
// generate command-specific flags
func (a *App) RunAsSubcommand(ctx *Context) (err error) {
	a.Setup()

	// append help to commands
	if len(a.Commands) > 0 {
		if a.Command(helpCommand.Name) == nil && !a.HideHelp {
			a.appendCommand(helpCommand)

			if HelpFlag != nil {
				a.appendFlag(HelpFlag)
			}
		}
	}

	var newCmds []*Command
	for _, c := range a.Commands {
		if c.HelpName == "" {
			c.HelpName = fmt.Sprintf("%s %s", a.HelpName, c.Name)
		}
		newCmds = append(newCmds, c)
	}
	a.Commands = newCmds

	set, err := a.newFlagSet()
	if err != nil {
		return err
	}

	err = parseIter(set, a, ctx.Args().Tail(), ctx.shellComplete)
	nerr := normalizeFlags(a.Flags, set)
	context := NewContext(a, set, ctx)

	if nerr != nil {
		_, _ = fmt.Fprintln(a.Writer, nerr)
		_, _ = fmt.Fprintln(a.Writer)
		if len(a.Commands) > 0 {
			_ = ShowSubcommandHelp(context)
		} else {
			_ = ShowCommandHelp(ctx, context.Args().First())
		}
		return nerr
	}

	if checkCompletions(context) {
		return nil
	}

	if err != nil {
		if a.OnUsageError != nil {
			err = a.OnUsageError(context, err, true)
			a.handleExitCoder(context, err)
			return err
		}
		_, _ = fmt.Fprintf(a.Writer, "%s %s\n\n", "Incorrect Usage.", err.Error())
		_ = ShowSubcommandHelp(context)
		return err
	}

	if len(a.Commands) > 0 {
		if checkSubcommandHelp(context) {
			return nil
		}
	} else {
		if checkCommandHelp(ctx, context.Args().First()) {
			return nil
		}
	}

	cerr := checkRequiredFlags(a.Flags, context)
	if cerr != nil {
		_ = ShowSubcommandHelp(context)
		return cerr
	}

	if a.After != nil {
		defer func() {
			afterErr := a.After(context)
			if afterErr != nil {
				a.handleExitCoder(context, err)
				if err != nil {
					err = newMultiError(err, afterErr)
				} else {
					err = afterErr
				}
			}
		}()
	}

	if a.Before != nil {
		beforeErr := a.Before(context)
		if beforeErr != nil {
			a.handleExitCoder(context, beforeErr)
			err = beforeErr
			return err
		}
	}

	args := context.Args()
	if args.Present() {
		name := args.First()
		c := a.Command(name)
		if c != nil {
			return c.Run(context)
		}
	}

	// Run default Action
	err = a.Action(context)

	a.handleExitCoder(context, err)
	return err
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

// VisibleFlags returns a slice of the Flags with Hidden=false
func (a *App) VisibleFlags() []Flag {
	return visibleFlags(a.Flags)
}

func (a *App) hasFlag(flag Flag) bool {
	for _, f := range a.Flags {
		if reflect.DeepEqual(flag, f) {
			return true
		}
	}

	return false
}

func (a *App) errWriter() io.Writer {
	// When the app ErrWriter is nil use the package level one.
	if a.ErrWriter == nil {
		return ErrWriter
	}

	return a.ErrWriter
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

func (a *App) handleExitCoder(context *Context, err error) {
	if a.ExitErrHandler != nil {
		a.ExitErrHandler(context, err)
	} else {
		HandleExitCoder(err)
	}
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
func HandleAction(action interface{}, context *Context) (err error) {
	switch a := action.(type) {
	case ActionFunc:
		return a(context)
	case func(*Context) error:
		return a(context)
	case func(*Context): // deprecated function signature
		a(context)
		return nil
	}

	return errInvalidActionType
}
