//go:build !urfave_cli_no_suggest
// +build !urfave_cli_no_suggest

package cli

import (
	"fmt"

	"github.com/xrash/smetrics"
)

func init() {
	SuggestFlag = suggestFlag
	SuggestCommand = suggestCommand
}

func jaroWinkler(a, b string) float64 {
	// magic values are from https://github.com/xrash/smetrics/blob/039620a656736e6ad994090895784a7af15e0b80/jaro-winkler.go#L8
	const (
		boostThreshold = 0.7
		prefixSize     = 4
	)
	return smetrics.JaroWinkler(a, b, boostThreshold, prefixSize)
}

func suggestFlag(flags []Flag, provided string, hideHelp bool) string {
	distance := 0.0
	suggestion := ""

	for _, flag := range flags {
		flagNames := flag.Names()
		if !hideHelp && HelpFlag != nil {
			flagNames = append(flagNames, HelpFlag.Names()...)
		}
		for _, name := range flagNames {
			newDistance := jaroWinkler(name, provided)
			if newDistance > distance {
				distance = newDistance
				suggestion = name
			}
		}
	}

	if len(suggestion) == 1 {
		suggestion = "-" + suggestion
	} else if len(suggestion) > 1 {
		suggestion = "--" + suggestion
	}

	return suggestion
}

// suggestCommand takes a list of commands and a provided string to suggest a
// command name
func suggestCommand(commands []*Command, provided string) (suggestion string) {
	distance := 0.0
	for _, command := range commands {
		for _, name := range append(command.Names(), helpName, helpAlias) {
			newDistance := jaroWinkler(name, provided)
			if newDistance > distance {
				distance = newDistance
				suggestion = name
			}
		}
	}

	return fmt.Sprintf(SuggestDidYouMeanTemplate, suggestion)
}
