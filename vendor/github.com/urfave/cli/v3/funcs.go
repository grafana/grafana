package cli

import "context"

// ShellCompleteFunc is an action to execute when the shell completion flag is set
type ShellCompleteFunc func(context.Context, *Command)

// BeforeFunc is an action that executes prior to any subcommands being run once
// the context is ready.  If a non-nil error is returned, no subcommands are
// run.
type BeforeFunc func(context.Context, *Command) (context.Context, error)

// AfterFunc is an action that executes after any subcommands are run and have
// finished. The AfterFunc is run even if Action() panics.
type AfterFunc func(context.Context, *Command) error

// ActionFunc is the action to execute when no subcommands are specified
type ActionFunc func(context.Context, *Command) error

// CommandNotFoundFunc is executed if the proper command cannot be found
type CommandNotFoundFunc func(context.Context, *Command, string)

// ConfigureShellCompletionCommand is a function to configure a shell completion command
type ConfigureShellCompletionCommand func(*Command)

// OnUsageErrorFunc is executed if a usage error occurs. This is useful for displaying
// customized usage error messages.  This function is able to replace the
// original error messages.  If this function is not set, the "Incorrect usage"
// is displayed and the execution is interrupted.
type OnUsageErrorFunc func(ctx context.Context, cmd *Command, err error, isSubcommand bool) error

// InvalidFlagAccessFunc is executed when an invalid flag is accessed from the context.
type InvalidFlagAccessFunc func(context.Context, *Command, string)

// ExitErrHandlerFunc is executed if provided in order to handle exitError values
// returned by Actions and Before/After functions.
type ExitErrHandlerFunc func(context.Context, *Command, error)

// FlagStringFunc is used by the help generation to display a flag, which is
// expected to be a single line.
type FlagStringFunc func(Flag) string

// FlagNamePrefixFunc is used by the default FlagStringFunc to create prefix
// text for a flag's full name.
type FlagNamePrefixFunc func(fullName []string, placeholder string) string

// FlagEnvHintFunc is used by the default FlagStringFunc to annotate flag help
// with the environment variable details.
type FlagEnvHintFunc func(envVars []string, str string) string

// FlagFileHintFunc is used by the default FlagStringFunc to annotate flag help
// with the file path details.
type FlagFileHintFunc func(filePath, str string) string
