package cli

import (
	"flag"
	"fmt"
	"sort"
	"strings"
)

// Command is a subcommand for a cli.App.
type Command struct {
	// The name of the command
	Name string
	// short name of the command. Typically one character (deprecated, use `Aliases`)
	ShortName string
	// A list of aliases for the command
	Aliases []string
	// A short description of the usage of this command
	Usage string
	// Custom text to show on USAGE section of help
	UsageText string
	// A longer explanation of how the command works
	Description string
	// A short description of the arguments of this command
	ArgsUsage string
	// The category the command is part of
	Category string
	// The function to call when checking for bash command completions
	BashComplete BashCompleteFunc
	// An action to execute before any sub-subcommands are run, but after the context is ready
	// If a non-nil error is returned, no sub-subcommands are run
	Before BeforeFunc
	// An action to execute after any subcommands are run, but after the subcommand has finished
	// It is run even if Action() panics
	After AfterFunc
	// The function to call when this command is invoked
	Action interface{}
	// TODO: replace `Action: interface{}` with `Action: ActionFunc` once some kind
	// of deprecation period has passed, maybe?

	// Execute this function if a usage error occurs.
	OnUsageError OnUsageErrorFunc
	// List of child commands
	Subcommands Commands
	// List of flags to parse
	Flags []Flag
	// Treat all flags as normal arguments if true
	SkipFlagParsing bool
	// Skip argument reordering which attempts to move flags before arguments,
	// but only works if all flags appear after all arguments. This behavior was
	// removed n version 2 since it only works under specific conditions so we
	// backport here by exposing it as an option for compatibility.
	SkipArgReorder bool
	// Boolean to hide built-in help command
	HideHelp bool
	// Boolean to hide this command from help or completion
	Hidden bool
	// Boolean to enable short-option handling so user can combine several
	// single-character bool arguments into one
	// i.e. foobar -o -v -> foobar -ov
	UseShortOptionHandling bool

	// Full name of command for help, defaults to full command name, including parent commands.
	HelpName        string
	commandNamePath []string

	// CustomHelpTemplate the text template for the command help topic.
	// cli.go uses text/template to render templates. You can
	// render custom help text by setting this variable.
	CustomHelpTemplate string
}

type CommandsByName []Command

func (c CommandsByName) Len() int {
	return len(c)
}

func (c CommandsByName) Less(i, j int) bool {
	return lexicographicLess(c[i].Name, c[j].Name)
}

func (c CommandsByName) Swap(i, j int) {
	c[i], c[j] = c[j], c[i]
}

// FullName returns the full name of the command.
// For subcommands this ensures that parent commands are part of the command path
func (c Command) FullName() string {
	if c.commandNamePath == nil {
		return c.Name
	}
	return strings.Join(c.commandNamePath, " ")
}

// Commands is a slice of Command
type Commands []Command

// Run invokes the command given the context, parses ctx.Args() to generate command-specific flags
func (c Command) Run(ctx *Context) (err error) {
	if !c.SkipFlagParsing {
		if len(c.Subcommands) > 0 {
			return c.startApp(ctx)
		}
	}

	if !c.HideHelp && (HelpFlag != BoolFlag{}) {
		// append help to flags
		c.Flags = append(
			c.Flags,
			HelpFlag,
		)
	}

	if ctx.App.UseShortOptionHandling {
		c.UseShortOptionHandling = true
	}

	set, err := c.parseFlags(ctx.Args().Tail(), ctx.shellComplete)

	context := NewContext(ctx.App, set, ctx)
	context.Command = c
	if checkCommandCompletions(context, c.Name) {
		return nil
	}

	if err != nil {
		if c.OnUsageError != nil {
			err := c.OnUsageError(context, err, false)
			context.App.handleExitCoder(context, err)
			return err
		}
		_, _ = fmt.Fprintln(context.App.Writer, "Incorrect Usage:", err.Error())
		_, _ = fmt.Fprintln(context.App.Writer)
		_ = ShowCommandHelp(context, c.Name)
		return err
	}

	if checkCommandHelp(context, c.Name) {
		return nil
	}

	cerr := checkRequiredFlags(c.Flags, context)
	if cerr != nil {
		_ = ShowCommandHelp(context, c.Name)
		return cerr
	}

	if c.After != nil {
		defer func() {
			afterErr := c.After(context)
			if afterErr != nil {
				context.App.handleExitCoder(context, err)
				if err != nil {
					err = NewMultiError(err, afterErr)
				} else {
					err = afterErr
				}
			}
		}()
	}

	if c.Before != nil {
		err = c.Before(context)
		if err != nil {
			context.App.handleExitCoder(context, err)
			return err
		}
	}

	if c.Action == nil {
		c.Action = helpSubcommand.Action
	}

	err = HandleAction(c.Action, context)

	if err != nil {
		context.App.handleExitCoder(context, err)
	}
	return err
}

func (c *Command) parseFlags(args Args, shellComplete bool) (*flag.FlagSet, error) {
	if c.SkipFlagParsing {
		set, err := c.newFlagSet()
		if err != nil {
			return nil, err
		}

		return set, set.Parse(append([]string{"--"}, args...))
	}

	if !c.SkipArgReorder {
		args = reorderArgs(c.Flags, args)
	}

	set, err := c.newFlagSet()
	if err != nil {
		return nil, err
	}

	err = parseIter(set, c, args, shellComplete)
	if err != nil {
		return nil, err
	}

	err = normalizeFlags(c.Flags, set)
	if err != nil {
		return nil, err
	}

	return set, nil
}

func (c *Command) newFlagSet() (*flag.FlagSet, error) {
	return flagSet(c.Name, c.Flags)
}

func (c *Command) useShortOptionHandling() bool {
	return c.UseShortOptionHandling
}

// reorderArgs moves all flags (via reorderedArgs) before the rest of
// the arguments (remainingArgs) as this is what flag expects.
func reorderArgs(commandFlags []Flag, args []string) []string {
	var remainingArgs, reorderedArgs []string

	nextIndexMayContainValue := false
	for i, arg := range args {

		// if we're expecting an option-value, check if this arg is a value, in
		// which case it should be re-ordered next to its associated flag
		if nextIndexMayContainValue && !argIsFlag(commandFlags, arg) {
			nextIndexMayContainValue = false
			reorderedArgs = append(reorderedArgs, arg)
		} else if arg == "--" {
			// don't reorder any args after the -- delimiter As described in the POSIX spec:
			// https://pubs.opengroup.org/onlinepubs/9699919799/basedefs/V1_chap12.html#tag_12_02
			// > Guideline 10:
			// >   The first -- argument that is not an option-argument should be accepted
			// >   as a delimiter indicating the end of options. Any following arguments
			// >   should be treated as operands, even if they begin with the '-' character.

			// make sure the "--" delimiter itself is at the start
			remainingArgs = append([]string{"--"}, remainingArgs...)
			remainingArgs = append(remainingArgs, args[i+1:]...)
			break
			// checks if this is an arg that should be re-ordered
		} else if argIsFlag(commandFlags, arg) {
			// we have determined that this is a flag that we should re-order
			reorderedArgs = append(reorderedArgs, arg)
			// if this arg does not contain a "=", then the next index may contain the value for this flag
			nextIndexMayContainValue = !strings.Contains(arg, "=")

			// simply append any remaining args
		} else {
			remainingArgs = append(remainingArgs, arg)
		}
	}

	return append(reorderedArgs, remainingArgs...)
}

// argIsFlag checks if an arg is one of our command flags
func argIsFlag(commandFlags []Flag, arg string) bool {
	if arg == "-" || arg == "--" {
		// `-` is never a flag
		// `--` is an option-value when following a flag, and a delimiter indicating the end of options in other cases.
		return false
	}
	// flags always start with a -
	if !strings.HasPrefix(arg, "-") {
		return false
	}
	// this line turns `--flag` into `flag`
	if strings.HasPrefix(arg, "--") {
		arg = strings.Replace(arg, "-", "", 2)
	}
	// this line turns `-flag` into `flag`
	if strings.HasPrefix(arg, "-") {
		arg = strings.Replace(arg, "-", "", 1)
	}
	// this line turns `flag=value` into `flag`
	arg = strings.Split(arg, "=")[0]
	// look through all the flags, to see if the `arg` is one of our flags
	for _, flag := range commandFlags {
		for _, key := range strings.Split(flag.GetName(), ",") {
			key := strings.TrimSpace(key)
			if key == arg {
				return true
			}
		}
	}
	// return false if this arg was not one of our flags
	return false
}

// Names returns the names including short names and aliases.
func (c Command) Names() []string {
	names := []string{c.Name}

	if c.ShortName != "" {
		names = append(names, c.ShortName)
	}

	return append(names, c.Aliases...)
}

// HasName returns true if Command.Name or Command.ShortName matches given name
func (c Command) HasName(name string) bool {
	for _, n := range c.Names() {
		if n == name {
			return true
		}
	}
	return false
}

func (c Command) startApp(ctx *Context) error {
	app := NewApp()
	app.Metadata = ctx.App.Metadata
	app.ExitErrHandler = ctx.App.ExitErrHandler
	// set the name and usage
	app.Name = fmt.Sprintf("%s %s", ctx.App.Name, c.Name)
	if c.HelpName == "" {
		app.HelpName = c.HelpName
	} else {
		app.HelpName = app.Name
	}

	app.Usage = c.Usage
	app.Description = c.Description
	app.ArgsUsage = c.ArgsUsage

	// set CommandNotFound
	app.CommandNotFound = ctx.App.CommandNotFound
	app.CustomAppHelpTemplate = c.CustomHelpTemplate

	// set the flags and commands
	app.Commands = c.Subcommands
	app.Flags = c.Flags
	app.HideHelp = c.HideHelp

	app.Version = ctx.App.Version
	app.HideVersion = ctx.App.HideVersion
	app.Compiled = ctx.App.Compiled
	app.Author = ctx.App.Author
	app.Email = ctx.App.Email
	app.Writer = ctx.App.Writer
	app.ErrWriter = ctx.App.ErrWriter
	app.UseShortOptionHandling = ctx.App.UseShortOptionHandling

	app.categories = CommandCategories{}
	for _, command := range c.Subcommands {
		app.categories = app.categories.AddCommand(command.Category, command)
	}

	sort.Sort(app.categories)

	// bash completion
	app.EnableBashCompletion = ctx.App.EnableBashCompletion
	if c.BashComplete != nil {
		app.BashComplete = c.BashComplete
	}

	// set the actions
	app.Before = c.Before
	app.After = c.After
	if c.Action != nil {
		app.Action = c.Action
	} else {
		app.Action = helpSubcommand.Action
	}
	app.OnUsageError = c.OnUsageError

	for index, cc := range app.Commands {
		app.Commands[index].commandNamePath = []string{c.Name, cc.Name}
	}

	return app.RunAsSubcommand(ctx)
}

// VisibleFlags returns a slice of the Flags with Hidden=false
func (c Command) VisibleFlags() []Flag {
	return visibleFlags(c.Flags)
}
