package cli

import (
	"context"
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

func buildHelpCommand(withAction bool) *Command {
	cmd := &Command{
		Name:      helpName,
		Aliases:   []string{helpAlias},
		Usage:     "Shows a list of commands or help for one command",
		ArgsUsage: "[command]",
		HideHelp:  true,
	}

	if withAction {
		cmd.Action = helpCommandAction
	}

	return cmd
}

func helpCommandAction(ctx context.Context, cmd *Command) error {
	args := cmd.Args()
	firstArg := args.First()

	tracef("doing help for cmd %[1]q with args %[2]q", cmd, args)

	// This action can be triggered by a "default" action of a command
	// or via cmd.Run when cmd == helpCmd. So we have following possibilities
	//
	// 1 $ app
	// 2 $ app help
	// 3 $ app foo
	// 4 $ app help foo
	// 5 $ app foo help

	// Case 4. when executing a help command set the context to parent
	// to allow resolution of subsequent args. This will transform
	// $ app help foo
	//     to
	// $ app foo
	// which will then be handled as case 3
	if cmd.parent != nil && (cmd.HasName(helpName) || cmd.HasName(helpAlias)) {
		tracef("setting cmd to cmd.parent")
		cmd = cmd.parent
	}

	// Case 4. $ app help foo
	// foo is the command for which help needs to be shown
	if firstArg != "" {
		/*	if firstArg == "--" {
			return nil
		}*/
		tracef("returning ShowCommandHelp with %[1]q", firstArg)
		return ShowCommandHelp(ctx, cmd, firstArg)
	}

	// Case 1 & 2
	// Special case when running help on main app itself as opposed to individual
	// commands/subcommands
	if cmd.parent == nil {
		tracef("returning ShowAppHelp")
		_ = ShowAppHelp(cmd)
		return nil
	}

	// Case 3, 5
	if (len(cmd.Commands) == 1 && !cmd.HideHelp) ||
		(len(cmd.Commands) == 0 && cmd.HideHelp) {

		tmpl := cmd.CustomHelpTemplate
		if tmpl == "" {
			tmpl = CommandHelpTemplate
		}

		tracef("running HelpPrinter with command %[1]q", cmd.Name)
		HelpPrinter(cmd.Root().Writer, tmpl, cmd)

		return nil
	}

	tracef("running ShowSubcommandHelp")
	return ShowSubcommandHelp(cmd)
}

// ShowAppHelpAndExit - Prints the list of subcommands for the app and exits with exit code.
func ShowAppHelpAndExit(cmd *Command, exitCode int) {
	_ = ShowAppHelp(cmd)
	os.Exit(exitCode)
}

// ShowAppHelp is an action that displays the help.
func ShowAppHelp(cmd *Command) error {
	tmpl := cmd.CustomRootCommandHelpTemplate
	if tmpl == "" {
		tracef("using RootCommandHelpTemplate")
		tmpl = RootCommandHelpTemplate
	}

	if cmd.ExtraInfo == nil {
		HelpPrinter(cmd.Root().Writer, tmpl, cmd.Root())
		return nil
	}

	tracef("setting ExtraInfo in customAppData")
	customAppData := func() map[string]any {
		return map[string]any{
			"ExtraInfo": cmd.ExtraInfo,
		}
	}
	HelpPrinterCustom(cmd.Root().Writer, tmpl, cmd.Root(), customAppData())

	return nil
}

// DefaultAppComplete prints the list of subcommands as the default app completion method
func DefaultAppComplete(ctx context.Context, cmd *Command) {
	DefaultCompleteWithFlags(ctx, cmd)
}

func printCommandSuggestions(commands []*Command, writer io.Writer) {
	for _, command := range commands {
		if command.Hidden {
			continue
		}
		if strings.HasSuffix(os.Getenv("SHELL"), "zsh") {
			_, _ = fmt.Fprintf(writer, "%s:%s\n", command.Name, command.Usage)
		} else {
			_, _ = fmt.Fprintf(writer, "%s\n", command.Name)
		}
	}
}

func cliArgContains(flagName string, args []string) bool {
	for _, name := range strings.Split(flagName, ",") {
		name = strings.TrimSpace(name)
		count := utf8.RuneCountInString(name)
		if count > 2 {
			count = 2
		}
		flag := fmt.Sprintf("%s%s", strings.Repeat("-", count), name)
		for _, a := range args {
			if a == flag {
				return true
			}
		}
	}
	return false
}

func printFlagSuggestions(lastArg string, flags []Flag, writer io.Writer) {
	// Trim to handle both "-short" and "--long" flags.
	cur := strings.TrimLeft(lastArg, "-")
	for _, flag := range flags {
		if bflag, ok := flag.(*BoolFlag); ok && bflag.Hidden {
			continue
		}

		usage := ""
		if docFlag, ok := flag.(DocGenerationFlag); ok {
			usage = docFlag.GetUsage()
		}

		name := strings.TrimSpace(flag.Names()[0])
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
		if strings.HasPrefix(name, cur) && cur != name /* && !cliArgContains(name, os.Args)*/ {
			flagCompletion := fmt.Sprintf("%s%s", strings.Repeat("-", count), name)
			if usage != "" && strings.HasSuffix(os.Getenv("SHELL"), "zsh") {
				flagCompletion = fmt.Sprintf("%s:%s", flagCompletion, usage)
			}
			fmt.Fprintln(writer, flagCompletion)
		}
	}
}

func DefaultCompleteWithFlags(ctx context.Context, cmd *Command) {
	args := os.Args
	if cmd != nil && cmd.parent != nil {
		args = cmd.Args().Slice()
		tracef("running default complete with flags[%v] on command %[2]q", args, cmd.Name)
	} else {
		tracef("running default complete with os.Args flags[%v]", args)
	}
	argsLen := len(args)
	lastArg := ""
	// parent command will have --generate-shell-completion so we need
	// to account for that
	if argsLen > 1 {
		lastArg = args[argsLen-2]
	} else if argsLen > 0 {
		lastArg = args[argsLen-1]
	}

	if lastArg == "--" {
		tracef("No completions due to termination")
		return
	}

	if lastArg == completionFlag {
		lastArg = ""
	}

	if strings.HasPrefix(lastArg, "-") {
		tracef("printing flag suggestion for flag[%v] on command %[1]q", lastArg, cmd.Name)
		printFlagSuggestions(lastArg, cmd.Flags, cmd.Root().Writer)
		return
	}

	if cmd != nil {
		tracef("printing command suggestions on command %[1]q", cmd.Name)
		printCommandSuggestions(cmd.Commands, cmd.Root().Writer)
		return
	}
}

// ShowCommandHelpAndExit - exits with code after showing help
func ShowCommandHelpAndExit(ctx context.Context, cmd *Command, command string, code int) {
	_ = ShowCommandHelp(ctx, cmd, command)
	os.Exit(code)
}

// ShowCommandHelp prints help for the given command
func ShowCommandHelp(ctx context.Context, cmd *Command, commandName string) error {
	for _, subCmd := range cmd.Commands {
		if !subCmd.HasName(commandName) {
			continue
		}

		tmpl := subCmd.CustomHelpTemplate
		if tmpl == "" {
			if len(subCmd.Commands) == 0 {
				tracef("using CommandHelpTemplate")
				tmpl = CommandHelpTemplate
			} else {
				tracef("using SubcommandHelpTemplate")
				tmpl = SubcommandHelpTemplate
			}
		}

		tracef("running HelpPrinter")
		HelpPrinter(cmd.Root().Writer, tmpl, subCmd)

		tracef("returning nil after printing help")
		return nil
	}

	tracef("no matching command found")

	if cmd.CommandNotFound == nil {
		errMsg := fmt.Sprintf("No help topic for '%v'", commandName)

		if cmd.Suggest {
			if suggestion := SuggestCommand(cmd.Commands, commandName); suggestion != "" {
				errMsg += ". " + suggestion
			}
		}

		tracef("exiting 3 with errMsg %[1]q", errMsg)
		return Exit(errMsg, 3)
	}

	tracef("running CommandNotFound func for %[1]q", commandName)
	cmd.CommandNotFound(ctx, cmd, commandName)

	return nil
}

// ShowSubcommandHelpAndExit - Prints help for the given subcommand and exits with exit code.
func ShowSubcommandHelpAndExit(cmd *Command, exitCode int) {
	_ = ShowSubcommandHelp(cmd)
	os.Exit(exitCode)
}

// ShowSubcommandHelp prints help for the given subcommand
func ShowSubcommandHelp(cmd *Command) error {
	HelpPrinter(cmd.Root().Writer, SubcommandHelpTemplate, cmd)
	return nil
}

// ShowVersion prints the version number of the App
func ShowVersion(cmd *Command) {
	tracef("showing version via VersionPrinter (cmd=%[1]q)", cmd.Name)
	VersionPrinter(cmd)
}

func printVersion(cmd *Command) {
	_, _ = fmt.Fprintf(cmd.Root().Writer, "%v version %v\n", cmd.Name, cmd.Version)
}

func handleTemplateError(err error) {
	if err != nil {
		tracef("error encountered during template parse: %[1]v", err)
		// If the writer is closed, t.Execute will fail, and there's nothing
		// we can do to recover.
		if os.Getenv("CLI_TEMPLATE_ERROR_DEBUG") != "" {
			_, _ = fmt.Fprintf(ErrWriter, "CLI TEMPLATE ERROR: %#v\n", err)
		}
		return
	}
}

// printHelpCustom is the default implementation of HelpPrinterCustom.
//
// The customFuncs map will be combined with a default template.FuncMap to
// allow using arbitrary functions in template rendering.
func printHelpCustom(out io.Writer, templ string, data interface{}, customFuncs map[string]interface{}) {
	const maxLineLength = 10000

	tracef("building default funcMap")
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

	if wa, ok := customFuncs["wrapAt"]; ok {
		if wrapAtFunc, ok := wa.(func() int); ok {
			wrapAt := wrapAtFunc()
			customFuncs["wrap"] = func(input string, offset int) string {
				return wrap(input, offset, wrapAt)
			}
		}
	}

	for key, value := range customFuncs {
		funcMap[key] = value
	}

	w := tabwriter.NewWriter(out, 1, 8, 2, ' ', 0)
	t := template.Must(template.New("help").Funcs(funcMap).Parse(templ))

	if _, err := t.New("helpNameTemplate").Parse(helpNameTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("argsTemplate").Parse(argsTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("usageTemplate").Parse(usageTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("descriptionTemplate").Parse(descriptionTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("visibleCommandTemplate").Parse(visibleCommandTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("copyrightTemplate").Parse(copyrightTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("versionTemplate").Parse(versionTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("visibleFlagCategoryTemplate").Parse(visibleFlagCategoryTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("visibleFlagTemplate").Parse(visibleFlagTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("visiblePersistentFlagTemplate").Parse(visiblePersistentFlagTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("visibleGlobalFlagCategoryTemplate").Parse(strings.ReplaceAll(visibleFlagCategoryTemplate, "OPTIONS", "GLOBAL OPTIONS")); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("authorsTemplate").Parse(authorsTemplate); err != nil {
		handleTemplateError(err)
	}

	if _, err := t.New("visibleCommandCategoryTemplate").Parse(visibleCommandCategoryTemplate); err != nil {
		handleTemplateError(err)
	}

	tracef("executing template")
	handleTemplateError(t.Execute(w, data))

	_ = w.Flush()
}

func printHelp(out io.Writer, templ string, data interface{}) {
	HelpPrinterCustom(out, templ, data, nil)
}

func checkVersion(cmd *Command) bool {
	found := false
	for _, name := range VersionFlag.Names() {
		if cmd.Bool(name) {
			found = true
		}
	}
	return found
}

func checkShellCompleteFlag(c *Command, arguments []string) (bool, []string) {
	if (c.parent == nil && !c.EnableShellCompletion) || (c.parent != nil && !c.Root().shellCompletion) {
		return false, arguments
	}

	pos := len(arguments) - 1
	lastArg := arguments[pos]

	if lastArg != completionFlag {
		return false, arguments
	}

	for _, arg := range arguments {
		// If arguments include "--", shell completion is disabled
		// because after "--" only positional arguments are accepted.
		// https://unix.stackexchange.com/a/11382
		if arg == "--" {
			return false, arguments[:pos]
		}
	}

	return true, arguments[:pos]
}

func checkCompletions(ctx context.Context, cmd *Command) bool {
	tracef("checking completions on command %[1]q", cmd.Name)

	if !cmd.Root().shellCompletion {
		tracef("completion not enabled skipping %[1]q", cmd.Name)
		return false
	}

	if argsArguments := cmd.Args(); argsArguments.Present() {
		name := argsArguments.First()
		if cmd := cmd.Command(name); cmd != nil {
			// let the command handle the completion
			return false
		}
	}

	tracef("no subcommand found for completion %[1]q", cmd.Name)

	if cmd.ShellComplete != nil {
		tracef("running shell completion func for command %[1]q", cmd.Name)
		cmd.ShellComplete(ctx, cmd)
	}

	return true
}

func subtract(a, b int) int {
	return a - b
}

func indent(spaces int, v string) string {
	pad := strings.Repeat(" ", spaces)
	return pad + strings.ReplaceAll(v, "\n", "\n"+pad)
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
	max := 0
	for _, cmd := range cmds {
		s := strings.Join(cmd.Names(), ", ")
		if len(s) > max {
			max = len(s)
		}
	}
	return max + fixed
}
