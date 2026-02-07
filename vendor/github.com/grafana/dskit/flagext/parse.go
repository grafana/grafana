package flagext

import (
	"flag"
	"fmt"
	"os"
	"strings"
)

// ParseFlagsAndArguments calls Parse() on the input flag.FlagSet and returns the parsed arguments.
func ParseFlagsAndArguments(f *flag.FlagSet) ([]string, error) {
	err := f.Parse(os.Args[1:])
	return f.Args(), err
}

// ParseFlagsWithoutArguments calls Parse() on the input flag.FlagSet and enforces no arguments have been parsed.
// This utility should be called whenever we only expect CLI flags but no arguments.
func ParseFlagsWithoutArguments(f *flag.FlagSet) error {
	if err := f.Parse(os.Args[1:]); err != nil {
		return err
	}

	if f.NArg() > 0 {
		return fmt.Errorf("the command does not support any argument, but some were provided: %s", strings.Join(f.Args(), " "))
	}

	return nil
}
