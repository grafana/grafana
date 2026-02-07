package cli

import (
	"bytes"
	"fmt"
	"io"
	"strings"
	"text/template"
)

// ToFishCompletion creates a fish completion string for the `*Command`
// The function errors if either parsing or writing of the string fails.
func (cmd *Command) ToFishCompletion() (string, error) {
	var w bytes.Buffer
	if err := cmd.writeFishCompletionTemplate(&w); err != nil {
		return "", err
	}
	return w.String(), nil
}

type fishCommandCompletionTemplate struct {
	Command     *Command
	Completions []string
	AllCommands []string
}

func (cmd *Command) writeFishCompletionTemplate(w io.Writer) error {
	const name = "cli"
	t, err := template.New(name).Parse(FishCompletionTemplate)
	if err != nil {
		return err
	}

	// Add global flags
	completions := prepareFishFlags(cmd.Name, cmd)

	// Add commands and their flags
	completions = append(
		completions,
		prepareFishCommands(cmd.Name, cmd)...,
	)

	toplevelCommandNames := []string{}
	for _, child := range cmd.Commands {
		toplevelCommandNames = append(toplevelCommandNames, child.Names()...)
	}

	return t.ExecuteTemplate(w, name, &fishCommandCompletionTemplate{
		Command:     cmd,
		Completions: completions,
		AllCommands: toplevelCommandNames,
	})
}

func prepareFishCommands(binary string, parent *Command) []string {
	commands := parent.Commands
	completions := []string{}
	for _, command := range commands {
		if !command.Hidden {
			var completion strings.Builder
			fmt.Fprintf(&completion,
				"complete -x -c %s -n '%s' -a '%s'",
				binary,
				fishSubcommandHelper(binary, parent, commands),
				command.Name,
			)

			if command.Usage != "" {
				fmt.Fprintf(&completion,
					" -d '%s'",
					escapeSingleQuotes(command.Usage))
			}
			completions = append(completions, completion.String())
		}
		completions = append(
			completions,
			prepareFishFlags(binary, command)...,
		)

		// recursively iterate subcommands
		completions = append(
			completions,
			prepareFishCommands(binary, command)...,
		)
	}

	return completions
}

func prepareFishFlags(binary string, owner *Command) []string {
	flags := owner.VisibleFlags()
	completions := []string{}
	for _, f := range flags {
		completion := &strings.Builder{}
		fmt.Fprintf(completion,
			"complete -c %s -n '%s'",
			binary,
			fishFlagHelper(binary, owner),
		)

		fishAddFileFlag(f, completion)

		for idx, opt := range f.Names() {
			if idx == 0 {
				fmt.Fprintf(completion,
					" -l %s", strings.TrimSpace(opt),
				)
			} else {
				fmt.Fprintf(completion,
					" -s %s", strings.TrimSpace(opt),
				)
			}
		}

		if flag, ok := f.(DocGenerationFlag); ok {
			if flag.TakesValue() {
				completion.WriteString(" -r")
			}

			if flag.GetUsage() != "" {
				fmt.Fprintf(completion,
					" -d '%s'",
					escapeSingleQuotes(flag.GetUsage()))
			}
		}

		completions = append(completions, completion.String())
	}

	return completions
}

func fishAddFileFlag(flag Flag, completion *strings.Builder) {
	switch f := flag.(type) {
	case *StringFlag:
		if f.TakesFile {
			return
		}
	case *StringSliceFlag:
		if f.TakesFile {
			return
		}
	}
	completion.WriteString(" -f")
}

func fishSubcommandHelper(binary string, command *Command, siblings []*Command) string {
	fishHelper := fmt.Sprintf("__fish_%s_no_subcommand", binary)
	if len(command.Lineage()) > 1 {
		var siblingNames []string
		for _, sibling := range siblings {
			siblingNames = append(siblingNames, sibling.Names()...)
		}
		ancestry := commandAncestry(command)
		fishHelper = fmt.Sprintf(
			"%s; and not __fish_seen_subcommand_from %s",
			ancestry,
			strings.Join(siblingNames, " "),
		)
	}
	return fishHelper
}

func fishFlagHelper(binary string, command *Command) string {
	fishHelper := fmt.Sprintf("__fish_%s_no_subcommand", binary)
	if len(command.Lineage()) > 1 {
		fishHelper = commandAncestry(command)
	}
	return fishHelper
}

func commandAncestry(command *Command) string {
	var ancestry []string
	ancestors := command.Lineage()
	for i := len(ancestors) - 2; i >= 0; i-- {
		ancestry = append(
			ancestry,
			fmt.Sprintf(
				"__fish_seen_subcommand_from %s",
				strings.Join(ancestors[i].Names(), " "),
			),
		)
	}
	return strings.Join(ancestry, "; and ")
}

func escapeSingleQuotes(input string) string {
	return strings.ReplaceAll(input, `'`, `\'`)
}
