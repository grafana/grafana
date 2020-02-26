package cli

import (
	"bytes"
	"fmt"
	"io"
	"sort"
	"strings"
	"text/template"

	"github.com/cpuguy83/go-md2man/v2/md2man"
)

// ToMarkdown creates a markdown string for the `*App`
// The function errors if either parsing or writing of the string fails.
func (a *App) ToMarkdown() (string, error) {
	var w bytes.Buffer
	if err := a.writeDocTemplate(&w); err != nil {
		return "", err
	}
	return w.String(), nil
}

// ToMan creates a man page string for the `*App`
// The function errors if either parsing or writing of the string fails.
func (a *App) ToMan() (string, error) {
	var w bytes.Buffer
	if err := a.writeDocTemplate(&w); err != nil {
		return "", err
	}
	man := md2man.Render(w.Bytes())
	return string(man), nil
}

type cliTemplate struct {
	App          *App
	Commands     []string
	GlobalArgs   []string
	SynopsisArgs []string
}

func (a *App) writeDocTemplate(w io.Writer) error {
	const name = "cli"
	t, err := template.New(name).Parse(MarkdownDocTemplate)
	if err != nil {
		return err
	}
	return t.ExecuteTemplate(w, name, &cliTemplate{
		App:          a,
		Commands:     prepareCommands(a.Commands, 0),
		GlobalArgs:   prepareArgsWithValues(a.VisibleFlags()),
		SynopsisArgs: prepareArgsSynopsis(a.VisibleFlags()),
	})
}

func prepareCommands(commands []*Command, level int) []string {
	var coms []string
	for _, command := range commands {
		if command.Hidden {
			continue
		}
		usage := ""
		if command.Usage != "" {
			usage = command.Usage
		}

		prepared := fmt.Sprintf("%s %s\n\n%s\n",
			strings.Repeat("#", level+2),
			strings.Join(command.Names(), ", "),
			usage,
		)

		flags := prepareArgsWithValues(command.Flags)
		if len(flags) > 0 {
			prepared += fmt.Sprintf("\n%s", strings.Join(flags, "\n"))
		}

		coms = append(coms, prepared)

		// recursevly iterate subcommands
		if len(command.Subcommands) > 0 {
			coms = append(
				coms,
				prepareCommands(command.Subcommands, level+1)...,
			)
		}
	}

	return coms
}

func prepareArgsWithValues(flags []Flag) []string {
	return prepareFlags(flags, ", ", "**", "**", `""`, true)
}

func prepareArgsSynopsis(flags []Flag) []string {
	return prepareFlags(flags, "|", "[", "]", "[value]", false)
}

func prepareFlags(
	flags []Flag,
	sep, opener, closer, value string,
	addDetails bool,
) []string {
	args := []string{}
	for _, f := range flags {
		flag, ok := f.(DocGenerationFlag)
		if !ok {
			continue
		}
		modifiedArg := opener

		for _, s := range flag.Names() {
			trimmed := strings.TrimSpace(s)
			if len(modifiedArg) > len(opener) {
				modifiedArg += sep
			}
			if len(trimmed) > 1 {
				modifiedArg += fmt.Sprintf("--%s", trimmed)
			} else {
				modifiedArg += fmt.Sprintf("-%s", trimmed)
			}
		}
		modifiedArg += closer
		if flag.TakesValue() {
			modifiedArg += fmt.Sprintf("=%s", value)
		}

		if addDetails {
			modifiedArg += flagDetails(flag)
		}

		args = append(args, modifiedArg+"\n")

	}
	sort.Strings(args)
	return args
}

// flagDetails returns a string containing the flags metadata
func flagDetails(flag DocGenerationFlag) string {
	description := flag.GetUsage()
	value := flag.GetValue()
	if value != "" {
		description += " (default: " + value + ")"
	}
	return ": " + description
}
