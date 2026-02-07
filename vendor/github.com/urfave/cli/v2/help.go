package cli

import (
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"
	"text/template"
	"unicode/utf8"
)

const (
	helpName  = "help"
	helpAlias = "h"
)

// this instance is to avoid recursion in the ShowCommandHelp which can
// add a help command again
var helpCommandDontUse = &Command{
	Name:      helpName,
	Aliases:   []string{helpAlias},
	Usage:     "Shows a list of commands or help for one command",
	ArgsUsage: "[command]",
}

var helpCommand = &Command{
	Name:      helpName,
	Aliases:   []string{helpAlias},
	Usage:     "Shows a list of commands or help for one command",
	ArgsUsage: "[command]",
	Action: func(cCtx *Context) error {
		args := cCtx.Args()
		argsPresent := args.First() != ""
		firstArg := args.First()

		// This action can be triggered by a "default" action of a command
		// or via cmd.Run when cmd == helpCmd. So we have following possibilities
		//
		// 1 $ app
		// 2 $ app help
		// 3 $ app foo
		// 4 $ app help foo
		// 5 $ app foo help
		// 6 $ app foo -h (with no other sub-commands nor flags defined)

		// Case 4. when executing a help command set the context to parent
		// to allow resolution of subsequent args. This will transform
		// $ app help foo
		//     to
		// $ app foo
		// which will then be handled as case 3
		if cCtx.Command.Name == helpName || cCtx.Command.Name == helpAlias {
			cCtx = cCtx.parentContext
		}

		// Case 4. $ app help foo
		// foo is the command for which help needs to be shown
		if argsPresent {
			return ShowCommandHelp(cCtx, firstArg)
		}

		// Case 1 & 2
		// Special case when running help on main app itself as opposed to individual
		// commands/subcommands
		if cCtx.parentContext.App == nil {
			_ = ShowAppHelp(cCtx)
			return nil
		}

		// Case 3, 5
		if (len(cCtx.Command.Subcommands) == 1 && !cCtx.Command.HideHelp && !cCtx.Command.HideHelpCommand) ||
			(len(cCtx.Command.Subcommands) == 0 && cCtx.Command.HideHelp) {
			templ := cCtx.Command.CustomHelpTemplate
			if templ == "" {
				templ = CommandHelpTemplate
			}
			HelpPrinter(cCtx.App.Writer, templ, cCtx.Command)
			return nil
		}

		// Case 6, handling incorporated in the callee itself
		return ShowSubcommandHelp(cCtx)
	},
}

// Prints help for the App or Command
type helpPrinter func(w io.Writer, templ string, data interface{})

// Prints help for the App or Command with custom template function.
type helpPrinterCustom func(w io.Writer, templ string, data interface{}, customFunc map[string]interface{})

// HelpPrinter is a function that writes the help output. If not set explicitly,
// this calls HelpPrinterCustom using only the default template functions.
//
// If custom logic for printing help is required, this function can be
// overridden. If the ExtraInfo field is defined on an App, this function
// should not be modified, as HelpPrinterCustom will be used directly in order
// to capture the extra information.
var HelpPrinter helpPrinter = printHelp

// HelpPrinterCustom is a function that writes the help output. It is used as
// the default implementation of HelpPrinter, and may be called directly if
// the ExtraInfo field is set on an App.
//
// In the default implementation, if the customFuncs argument contains a
// "wrapAt" key, which is a function which takes no arguments and returns
// an int, this int value will be used to produce a "wrap" function used
// by the default template to wrap long lines.
var HelpPrinterCustom helpPrinterCustom = printHelpCustom

// VersionPrinter prints the version for the App
var VersionPrinter = printVersion

// ShowAppHelpAndExit - Prints the list of subcommands for the app and exits with exit code.
func ShowAppHelpAndExit(c *Context, exitCode int) {
	_ = ShowAppHelp(c)
	os.Exit(exitCode)
}

// ShowAppHelp is an action that displays the help.
func ShowAppHelp(cCtx *Context) error {
	tpl := cCtx.App.CustomAppHelpTemplate
	if tpl == "" {
		tpl = AppHelpTemplate
	}

	if cCtx.App.ExtraInfo == nil {
		HelpPrinter(cCtx.App.Writer, tpl, cCtx.App)
		return nil
	}

	customAppData := func() map[string]interface{} {
		return map[string]interface{}{
			"ExtraInfo": cCtx.App.ExtraInfo,
		}
	}
	HelpPrinterCustom(cCtx.App.Writer, tpl, cCtx.App, customAppData())

	return nil
}

// DefaultAppComplete prints the list of subcommands as the default app completion method
func DefaultAppComplete(cCtx *Context) {
	DefaultCompleteWithFlags(nil)(cCtx)
}

func printCommandSuggestions(commands []*Command, writer io.Writer) {
	for _, command := range commands {
		if command.Hidden {
			continue
		}
		if strings.HasSuffix(os.Getenv("0"), "zsh") {
			for _, name := range command.Names() {
				_, _ = fmt.Fprintf(writer, "%s:%s\n", name, command.Usage)
			}
		} else {
			for _, name := range command.Names() {
				_, _ = fmt.Fprintf(writer, "%s\n", name)
			}
		}
	}
}

func cliArgContains(flagName string) bool {
	for _, name := range strings.Split(flagName, ",") {
		name = strings.TrimSpace(name)
		count := utf8.RuneCountInString(name)
		if count > 2 {
			count = 2
		}
		flag := fmt.Sprintf("%s%s", strings.Repeat("-", count), name)
		for _, a := range os.Args {
			if a == flag {
				return true
			}
		}
	}
	return false
}

func printFlagSuggestions(lastArg string, flags []Flag, writer io.Writer) {
	cur := strings.TrimPrefix(lastArg, "-")
	cur = strings.TrimPrefix(cur, "-")
	for _, flag := range flags {
		if bflag, ok := flag.(*BoolFlag); ok && bflag.Hidden {
			continue
		}
		for _, name := range flag.Names() {
			name = strings.TrimSpace(name)
			// this will get total count utf8 letters in flag name
			count := utf8.RuneCountInString(name)
			if count > 2 {
				count = 2 // reuse this count to generate single - or -- in flag completion
			}
			// if flag name has more than one utf8 letter and last argument in cli has -- prefix then
			// skip flag completion for short flags example -v or -x
			if strings.HasPrefix(lastArg, "--") && count == 1 {
				continue
			}
			// match if last argument matches this flag and it is not repeated
			if strings.HasPrefix(name, cur) && cur != name && !cliArgContains(name) {
				flagCompletion := fmt.Sprintf("%s%s", strings.Repeat("-", count), name)
				_, _ = fmt.Fprintln(writer, flagCompletion)
			}
		}
	}
}

func DefaultCompleteWithFlags(cmd *Command) func(cCtx *Context) {
	return func(cCtx *Context) {
		var lastArg string

		// TODO: This shouldnt depend on os.Args rather it should
		// depend on root arguments passed to App
		if len(os.Args) > 2 {
			lastArg = os.Args[len(os.Args)-2]
		}

		if lastArg != "" {
			if strings.HasPrefix(lastArg, "-") {
				if cmd != nil {
					printFlagSuggestions(lastArg, cmd.Flags, cCtx.App.Writer)

					return
				}

				printFlagSuggestions(lastArg, cCtx.App.Flags, cCtx.App.Writer)

				return
			}
		}

		if cmd != nil {
			printCommandSuggestions(cmd.Subcommands, cCtx.App.Writer)
			return
		}

		printCommandSuggestions(cCtx.Command.Subcommands, cCtx.App.Writer)
	}
}

// ShowCommandHelpAndExit - exits with code after showing help
func ShowCommandHelpAndExit(c *Context, command string, code int) {
	_ = ShowCommandHelp(c, command)
	os.Exit(code)
}

// ShowCommandHelp prints help for the given command
func ShowCommandHelp(ctx *Context, command string) error {
	commands := ctx.App.Commands
	if ctx.Command.Subcommands != nil {
		commands = ctx.Command.Subcommands
	}
	for _, c := range commands {
		if c.HasName(command) {
			if !ctx.App.HideHelpCommand && !c.HasName(helpName) && len(c.Subcommands) != 0 && c.Command(helpName) == nil {
				c.Subcommands = append(c.Subcommands, helpCommandDontUse)
			}
			if !ctx.App.HideHelp && HelpFlag != nil {
				c.appendFlag(HelpFlag)
			}
			templ := c.CustomHelpTemplate
			if templ == "" {
				if len(c.Subcommands) == 0 {
					templ = CommandHelpTemplate
				} else {
					templ = SubcommandHelpTemplate
				}
			}

			HelpPrinter(ctx.App.Writer, templ, c)

			return nil
		}
	}

	if ctx.App.CommandNotFound == nil {
		errMsg := fmt.Sprintf("No help topic for '%v'", command)
		if ctx.App.Suggest && SuggestCommand != nil {
			if suggestion := SuggestCommand(ctx.Command.Subcommands, command); suggestion != "" {
				errMsg += ". " + suggestion
			}
		}
		return Exit(errMsg, 3)
	}

	ctx.App.CommandNotFound(ctx, command)
	return nil
}

// ShowSubcommandHelpAndExit - Prints help for the given subcommand and exits with exit code.
func ShowSubcommandHelpAndExit(c *Context, exitCode int) {
	_ = ShowSubcommandHelp(c)
	os.Exit(exitCode)
}

// ShowSubcommandHelp prints help for the given subcommand
func ShowSubcommandHelp(cCtx *Context) error {
	if cCtx == nil {
		return nil
	}
	// use custom template when provided (fixes #1703)
	templ := SubcommandHelpTemplate
	if cCtx.Command != nil && cCtx.Command.CustomHelpTemplate != "" {
		templ = cCtx.Command.CustomHelpTemplate
	}
	HelpPrinter(cCtx.App.Writer, templ, cCtx.Command)
	return nil
}

// ShowVersion prints the version number of the App
func ShowVersion(cCtx *Context) {
	VersionPrinter(cCtx)
}

func printVersion(cCtx *Context) {
	_, _ = fmt.Fprintf(cCtx.App.Writer, "%v version %v\n", cCtx.App.Name, cCtx.App.Version)
}

// ShowCompletions prints the lists of commands within a given context
func ShowCompletions(cCtx *Context) {
	c := cCtx.Command
	if c != nil && c.BashComplete != nil {
		c.BashComplete(cCtx)
	}
}

// ShowCommandCompletions prints the custom completions for a given command
func ShowCommandCompletions(ctx *Context, command string) {
	c := ctx.Command.Command(command)
	if c != nil {
		if c.BashComplete != nil {
			c.BashComplete(ctx)
		} else {
			DefaultCompleteWithFlags(c)(ctx)
		}
	}
}

// printHelpCustom is the default implementation of HelpPrinterCustom.
//
// The customFuncs map will be combined with a default template.FuncMap to
// allow using arbitrary functions in template rendering.
func printHelpCustom(out io.Writer, templ string, data interface{}, customFuncs map[string]interface{}) {
	const maxLineLength = 10000

	funcMap := template.FuncMap{
		"join":           strings.Join,
		"subtract":       subtract,
		"indent":         indent,
		"nindent":        nindent,
		"trim":           strings.TrimSpace,
		"wrap":           func(input string, offset int) string { return wrap(input, offset, maxLineLength) },
		"offset":         offset,
		"offsetCommands": offsetCommands,
	}

	if customFuncs["wrapAt"] != nil {
		if wa, ok := customFuncs["wrapAt"]; ok {
			if waf, ok := wa.(func() int); ok {
				wrapAt := waf()
				customFuncs["wrap"] = func(input string, offset int) string {
					return wrap(input, offset, wrapAt)
				}
			}
		}
	}

	for key, value := range customFuncs {
		funcMap[key] = value
	}

	w := tabwriter.NewWriter(out, 1, 8, 2, ' ', 0)
	t := template.Must(template.New("help").Funcs(funcMap).Parse(templ))
	templates := map[string]string{
		"helpNameTemplate":                  helpNameTemplate,
		"usageTemplate":                     usageTemplate,
		"descriptionTemplate":               descriptionTemplate,
		"visibleCommandTemplate":            visibleCommandTemplate,
		"copyrightTemplate":                 copyrightTemplate,
		"versionTemplate":                   versionTemplate,
		"visibleFlagCategoryTemplate":       visibleFlagCategoryTemplate,
		"visibleFlagTemplate":               visibleFlagTemplate,
		"visibleGlobalFlagCategoryTemplate": strings.Replace(visibleFlagCategoryTemplate, "OPTIONS", "GLOBAL OPTIONS", -1),
		"authorsTemplate":                   authorsTemplate,
		"visibleCommandCategoryTemplate":    visibleCommandCategoryTemplate,
	}
	for name, value := range templates {
		if _, err := t.New(name).Parse(value); err != nil {
			if os.Getenv("CLI_TEMPLATE_ERROR_DEBUG") != "" {
				_, _ = fmt.Fprintf(ErrWriter, "CLI TEMPLATE ERROR: %#v\n", err)
			}
		}
	}

	err := t.Execute(w, data)
	if err != nil {
		// If the writer is closed, t.Execute will fail, and there's nothing
		// we can do to recover.
		if os.Getenv("CLI_TEMPLATE_ERROR_DEBUG") != "" {
			_, _ = fmt.Fprintf(ErrWriter, "CLI TEMPLATE ERROR: %#v\n", err)
		}
		return
	}
	_ = w.Flush()
}

func printHelp(out io.Writer, templ string, data interface{}) {
	HelpPrinterCustom(out, templ, data, nil)
}

func checkVersion(cCtx *Context) bool {
	found := false
	for _, name := range VersionFlag.Names() {
		if cCtx.Bool(name) {
			found = true
		}
	}
	return found
}

func checkHelp(cCtx *Context) bool {
	if HelpFlag == nil {
		return false
	}
	found := false
	for _, name := range HelpFlag.Names() {
		if cCtx.Bool(name) {
			found = true
			break
		}
	}

	return found
}

func checkShellCompleteFlag(a *App, arguments []string) (bool, []string) {
	if !a.EnableBashCompletion {
		return false, arguments
	}

	pos := len(arguments) - 1
	lastArg := arguments[pos]

	if lastArg != "--generate-bash-completion" {
		return false, arguments
	}

	for _, arg := range arguments {
		// If arguments include "--", shell completion is disabled
		// because after "--" only positional arguments are accepted.
		// https://unix.stackexchange.com/a/11382
		if arg == "--" {
			return false, arguments
		}
	}

	return true, arguments[:pos]
}

func checkCompletions(cCtx *Context) bool {
	if !cCtx.shellComplete {
		return false
	}

	if args := cCtx.Args(); args.Present() {
		name := args.First()
		if cmd := cCtx.Command.Command(name); cmd != nil {
			// let the command handle the completion
			return false
		}
	}

	ShowCompletions(cCtx)
	return true
}

func subtract(a, b int) int {
	return a - b
}

func indent(spaces int, v string) string {
	pad := strings.Repeat(" ", spaces)
	return pad + strings.Replace(v, "\n", "\n"+pad, -1)
}

func nindent(spaces int, v string) string {
	return "\n" + indent(spaces, v)
}

func wrap(input string, offset int, wrapAt int) string {
	var ss []string

	lines := strings.Split(input, "\n")

	padding := strings.Repeat(" ", offset)

	for i, line := range lines {
		if line == "" {
			ss = append(ss, line)
		} else {
			wrapped := wrapLine(line, offset, wrapAt, padding)
			if i == 0 {
				ss = append(ss, wrapped)
			} else {
				ss = append(ss, padding+wrapped)
			}

		}
	}

	return strings.Join(ss, "\n")
}

func wrapLine(input string, offset int, wrapAt int, padding string) string {
	if wrapAt <= offset || len(input) <= wrapAt-offset {
		return input
	}

	lineWidth := wrapAt - offset
	words := strings.Fields(input)
	if len(words) == 0 {
		return input
	}

	wrapped := words[0]
	spaceLeft := lineWidth - len(wrapped)
	for _, word := range words[1:] {
		if len(word)+1 > spaceLeft {
			wrapped += "\n" + padding + word
			spaceLeft = lineWidth - len(word)
		} else {
			wrapped += " " + word
			spaceLeft -= 1 + len(word)
		}
	}

	return wrapped
}

func offset(input string, fixed int) int {
	return len(input) + fixed
}

// this function tries to find the max width of the names column
// so say we have the following rows for help
//
//	foo1, foo2, foo3  some string here
//	bar1, b2 some other string here
//
// We want to offset the 2nd row usage by some amount so that everything
// is aligned
//
//	foo1, foo2, foo3  some string here
//	bar1, b2          some other string here
//
// to find that offset we find the length of all the rows and use the max
// to calculate the offset
func offsetCommands(cmds []*Command, fixed int) int {
	var max int = 0
	for _, cmd := range cmds {
		s := strings.Join(cmd.Names(), ", ")
		if len(s) > max {
			max = len(s)
		}
	}
	return max + fixed
}
