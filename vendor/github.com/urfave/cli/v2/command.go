package cli

import (
	"flag"
	"fmt"
	"reflect"
	"sort"
	"strings"
)

// Command is a subcommand for a cli.App.
type Command struct {
	// The name of the command
	Name string
	// A list of aliases for the command
	Aliases []string
	// A short description of the usage of this command
	Usage string
	// Custom text to show on USAGE section of help
	UsageText string
	// A longer explanation of how the command works
	Description string
	// Whether this command supports arguments
	Args bool
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
	Action ActionFunc
	// Execute this function if a usage error occurs.
	OnUsageError OnUsageErrorFunc
	// List of child commands
	Subcommands []*Command
	// List of flags to parse
	Flags          []Flag
	flagCategories FlagCategories
	// Treat all flags as normal arguments if true
	SkipFlagParsing bool
	// Boolean to hide built-in help command and help flag
	HideHelp bool
	// Boolean to hide built-in help command but keep help flag
	// Ignored if HideHelp is true.
	HideHelpCommand bool
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

	// categories contains the categorized commands and is populated on app startup
	categories CommandCategories

	// if this is a root "special" command
	isRoot bool

	separator separatorSpec
}

type Commands []*Command

type CommandsByName []*Command

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
func (c *Command) FullName() string {
	if c.commandNamePath == nil {
		return c.Name
	}
	return strings.Join(c.commandNamePath, " ")
}

func (cmd *Command) Command(name string) *Command {
	for _, c := range cmd.Subcommands {
		if c.HasName(name) {
			return c
		}
	}

	return nil
}

func (c *Command) setup(ctx *Context) {
	if c.Command(helpCommand.Name) == nil && !c.HideHelp {
		if !c.HideHelpCommand {
			c.Subcommands = append(c.Subcommands, helpCommand)
		}
	}

	if !c.HideHelp && HelpFlag != nil {
		// append help to flags
		c.appendFlag(HelpFlag)
	}

	if ctx.App.UseShortOptionHandling {
		c.UseShortOptionHandling = true
	}

	c.categories = newCommandCategories()
	for _, command := range c.Subcommands {
		c.categories.AddCommand(command.Category, command)
	}
	sort.Sort(c.categories.(*commandCategories))

	for _, scmd := range c.Subcommands {
		if scmd.HelpName == "" {
			scmd.HelpName = fmt.Sprintf("%s %s", c.HelpName, scmd.Name)
		}
		scmd.separator = c.separator
	}

	if c.BashComplete == nil {
		c.BashComplete = DefaultCompleteWithFlags(c)
	}
}

func (c *Command) Run(cCtx *Context, arguments ...string) (err error) {

	if !c.isRoot {
		c.setup(cCtx)
		if err := checkDuplicatedCmds(c); err != nil {
			return err
		}
	}

	a := args(arguments)
	set, err := c.parseFlags(&a, cCtx.shellComplete)
	cCtx.flagSet = set

	if checkCompletions(cCtx) {
		return nil
	}

	if err != nil {
		if c.OnUsageError != nil {
			err = c.OnUsageError(cCtx, err, !c.isRoot)
			cCtx.App.handleExitCoder(cCtx, err)
			return err
		}
		_, _ = fmt.Fprintf(cCtx.App.Writer, "%s %s\n\n", "Incorrect Usage:", err.Error())
		if cCtx.App.Suggest {
			if suggestion, err := c.suggestFlagFromError(err, ""); err == nil {
				fmt.Fprintf(cCtx.App.Writer, "%s", suggestion)
			}
		}
		if !c.HideHelp {
			if c.isRoot {
				_ = ShowAppHelp(cCtx)
			} else {
				_ = ShowCommandHelp(cCtx.parentContext, c.Name)
			}
		}
		return err
	}

	if checkHelp(cCtx) {
		return helpCommand.Action(cCtx)
	}

	if c.isRoot && !cCtx.App.HideVersion && checkVersion(cCtx) {
		ShowVersion(cCtx)
		return nil
	}

	if c.After != nil && !cCtx.shellComplete {
		defer func() {
			afterErr := c.After(cCtx)
			if afterErr != nil {
				cCtx.App.handleExitCoder(cCtx, err)
				if err != nil {
					err = newMultiError(err, afterErr)
				} else {
					err = afterErr
				}
			}
		}()
	}

	cerr := cCtx.checkRequiredFlags(c.Flags)
	if cerr != nil {
		_ = helpCommand.Action(cCtx)
		return cerr
	}

	if c.Before != nil && !cCtx.shellComplete {
		beforeErr := c.Before(cCtx)
		if beforeErr != nil {
			cCtx.App.handleExitCoder(cCtx, beforeErr)
			err = beforeErr
			return err
		}
	}

	if err = runFlagActions(cCtx, c.Flags); err != nil {
		return err
	}

	var cmd *Command
	args := cCtx.Args()
	if args.Present() {
		name := args.First()
		cmd = c.Command(name)
		if cmd == nil {
			hasDefault := cCtx.App.DefaultCommand != ""
			isFlagName := checkStringSliceIncludes(name, cCtx.FlagNames())

			var (
				isDefaultSubcommand   = false
				defaultHasSubcommands = false
			)

			if hasDefault {
				dc := cCtx.App.Command(cCtx.App.DefaultCommand)
				defaultHasSubcommands = len(dc.Subcommands) > 0
				for _, dcSub := range dc.Subcommands {
					if checkStringSliceIncludes(name, dcSub.Names()) {
						isDefaultSubcommand = true
						break
					}
				}
			}

			if isFlagName || (hasDefault && (defaultHasSubcommands && isDefaultSubcommand)) {
				argsWithDefault := cCtx.App.argsWithDefaultCommand(args)
				if !reflect.DeepEqual(args, argsWithDefault) {
					cmd = cCtx.App.rootCommand.Command(argsWithDefault.First())
				}
			}
		}
	} else if c.isRoot && cCtx.App.DefaultCommand != "" {
		if dc := cCtx.App.Command(cCtx.App.DefaultCommand); dc != c {
			cmd = dc
		}
	}

	if cmd != nil {
		newcCtx := NewContext(cCtx.App, nil, cCtx)
		newcCtx.Command = cmd
		return cmd.Run(newcCtx, cCtx.Args().Slice()...)
	}

	if c.Action == nil {
		c.Action = helpCommand.Action
	}

	err = c.Action(cCtx)

	cCtx.App.handleExitCoder(cCtx, err)
	return err
}

func (c *Command) newFlagSet() (*flag.FlagSet, error) {
	return flagSet(c.Name, c.Flags, c.separator)
}

func (c *Command) useShortOptionHandling() bool {
	return c.UseShortOptionHandling
}

func (c *Command) suggestFlagFromError(err error, command string) (string, error) {
	flag, parseErr := flagFromError(err)
	if parseErr != nil {
		return "", err
	}

	flags := c.Flags
	hideHelp := c.HideHelp
	if command != "" {
		cmd := c.Command(command)
		if cmd == nil {
			return "", err
		}
		flags = cmd.Flags
		hideHelp = hideHelp || cmd.HideHelp
	}

	suggestion := SuggestFlag(flags, flag, hideHelp)
	if len(suggestion) == 0 {
		return "", err
	}

	return fmt.Sprintf(SuggestDidYouMeanTemplate, suggestion) + "\n\n", nil
}

func (c *Command) parseFlags(args Args, shellComplete bool) (*flag.FlagSet, error) {
	set, err := c.newFlagSet()
	if err != nil {
		return nil, err
	}

	if c.SkipFlagParsing {
		return set, set.Parse(append([]string{"--"}, args.Tail()...))
	}

	err = parseIter(set, c, args.Tail(), shellComplete)
	if err != nil {
		return nil, err
	}

	err = normalizeFlags(c.Flags, set)
	if err != nil {
		return nil, err
	}

	return set, nil
}

// Names returns the names including short names and aliases.
func (c *Command) Names() []string {
	return append([]string{c.Name}, c.Aliases...)
}

// HasName returns true if Command.Name matches given name
func (c *Command) HasName(name string) bool {
	for _, n := range c.Names() {
		if n == name {
			return true
		}
	}
	return false
}

// VisibleCategories returns a slice of categories and commands that are
// Hidden=false
func (c *Command) VisibleCategories() []CommandCategory {
	ret := []CommandCategory{}
	for _, category := range c.categories.Categories() {
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
func (c *Command) VisibleCommands() []*Command {
	var ret []*Command
	for _, command := range c.Subcommands {
		if !command.Hidden {
			ret = append(ret, command)
		}
	}
	return ret
}

// VisibleFlagCategories returns a slice containing all the visible flag categories with the flags they contain
func (c *Command) VisibleFlagCategories() []VisibleFlagCategory {
	if c.flagCategories == nil {
		c.flagCategories = newFlagCategoriesFromFlags(c.Flags)
	}
	return c.flagCategories.VisibleCategories()
}

// VisibleFlags returns a slice of the Flags with Hidden=false
func (c *Command) VisibleFlags() []Flag {
	return visibleFlags(c.Flags)
}

func (c *Command) appendFlag(fl Flag) {
	if !hasFlag(c.Flags, fl) {
		c.Flags = append(c.Flags, fl)
	}
}

func hasCommand(commands []*Command, command *Command) bool {
	for _, existing := range commands {
		if command == existing {
			return true
		}
	}

	return false
}

func checkDuplicatedCmds(parent *Command) error {
	seen := make(map[string]struct{})
	for _, c := range parent.Subcommands {
		for _, name := range c.Names() {
			if _, exists := seen[name]; exists {
				return fmt.Errorf("parent command [%s] has duplicated subcommand name or alias: %s", parent.Name, name)
			}
			seen[name] = struct{}{}
		}
	}
	return nil
}
