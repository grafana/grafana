package cli

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"reflect"
	"slices"
	"unicode"
)

func (cmd *Command) parseArgsFromStdin() ([]string, error) {
	type state int
	const (
		stateSearchForToken  state = -1
		stateSearchForString state = 0
	)

	st := stateSearchForToken
	linenum := 1
	token := ""
	args := []string{}

	breader := bufio.NewReader(cmd.Reader)

outer:
	for {
		ch, _, err := breader.ReadRune()
		if err == io.EOF {
			switch st {
			case stateSearchForToken:
				if token != "--" {
					args = append(args, token)
				}
			case stateSearchForString:
				// make sure string is not empty
				for _, t := range token {
					if !unicode.IsSpace(t) {
						args = append(args, token)
					}
				}
			}
			break outer
		}
		if err != nil {
			return nil, err
		}
		switch st {
		case stateSearchForToken:
			if unicode.IsSpace(ch) || ch == '"' {
				if ch == '\n' {
					linenum++
				}
				if token != "" {
					// end the processing here
					if token == "--" {
						break outer
					}
					args = append(args, token)
					token = ""
				}
				if ch == '"' {
					st = stateSearchForString
				}
				continue
			}
			token += string(ch)
		case stateSearchForString:
			if ch != '"' {
				token += string(ch)
			} else {
				if token != "" {
					args = append(args, token)
					token = ""
				}
				/*else {
					//TODO. Should we pass in empty strings ?
				}*/
				st = stateSearchForToken
			}
		}
	}

	tracef("parsed stdin args as %v (cmd=%[2]q)", args, cmd.Name)

	return args, nil
}

// Run is the entry point to the command graph. The positional
// arguments are parsed according to the Flag and Command
// definitions and the matching Action functions are run.
func (cmd *Command) Run(ctx context.Context, osArgs []string) (deferErr error) {
	_, deferErr = cmd.run(ctx, osArgs)
	return
}

func (cmd *Command) run(ctx context.Context, osArgs []string) (_ context.Context, deferErr error) {
	tracef("running with arguments %[1]q (cmd=%[2]q)", osArgs, cmd.Name)
	cmd.setupDefaults(osArgs)

	if v, ok := ctx.Value(commandContextKey).(*Command); ok {
		tracef("setting parent (cmd=%[1]q) command from context.Context value (cmd=%[2]q)", v.Name, cmd.Name)
		cmd.parent = v
	}

	if cmd.parent == nil {
		if cmd.ReadArgsFromStdin {
			if args, err := cmd.parseArgsFromStdin(); err != nil {
				return ctx, err
			} else {
				osArgs = append(osArgs, args...)
			}
		}
		// handle the completion flag separately from the flagset since
		// completion could be attempted after a flag, but before its value was put
		// on the command line. this causes the flagset to interpret the completion
		// flag name as the value of the flag before it which is undesirable
		// note that we can only do this because the shell autocomplete function
		// always appends the completion flag at the end of the command
		tracef("checking osArgs %v (cmd=%[2]q)", osArgs, cmd.Name)
		cmd.shellCompletion, osArgs = checkShellCompleteFlag(cmd, osArgs)

		tracef("setting cmd.shellCompletion=%[1]v from checkShellCompleteFlag (cmd=%[2]q)", cmd.shellCompletion && cmd.EnableShellCompletion, cmd.Name)
		cmd.shellCompletion = cmd.EnableShellCompletion && cmd.shellCompletion
	}

	tracef("using post-checkShellCompleteFlag arguments %[1]q (cmd=%[2]q)", osArgs, cmd.Name)

	tracef("setting self as cmd in context (cmd=%[1]q)", cmd.Name)
	ctx = context.WithValue(ctx, commandContextKey, cmd)

	if cmd.parent == nil {
		cmd.setupCommandGraph()
	}

	var rargs Args = &stringSliceArgs{v: osArgs}
	for _, f := range cmd.allFlags() {
		if err := f.PreParse(); err != nil {
			return ctx, err
		}
	}

	var args Args = &stringSliceArgs{rargs.Tail()}
	var err error

	if cmd.SkipFlagParsing {
		tracef("skipping flag parsing (cmd=%[1]q)", cmd.Name)
		cmd.parsedArgs = args
	} else {
		cmd.parsedArgs, err = cmd.parseFlags(args)
	}

	tracef("using post-parse arguments %[1]q (cmd=%[2]q)", args, cmd.Name)

	if checkCompletions(ctx, cmd) {
		return ctx, nil
	}

	if err != nil {
		tracef("setting deferErr from %[1]q (cmd=%[2]q)", err, cmd.Name)
		deferErr = err

		cmd.isInError = true
		if cmd.OnUsageError != nil {
			err = cmd.OnUsageError(ctx, cmd, err, cmd.parent != nil)
			err = cmd.handleExitCoder(ctx, err)
			return ctx, err
		}
		fmt.Fprintf(cmd.Root().ErrWriter, "Incorrect Usage: %s\n\n", err.Error())
		if cmd.Suggest {
			if suggestion, err := cmd.suggestFlagFromError(err, ""); err == nil {
				fmt.Fprintf(cmd.Root().ErrWriter, "%s", suggestion)
			}
		}
		if !cmd.hideHelp() {
			if cmd.parent == nil {
				tracef("running ShowAppHelp")
				if err := ShowAppHelp(cmd); err != nil {
					tracef("SILENTLY IGNORING ERROR running ShowAppHelp %[1]v (cmd=%[2]q)", err, cmd.Name)
				}
			} else {
				tracef("running ShowCommandHelp with %[1]q", cmd.Name)
				if err := ShowCommandHelp(ctx, cmd, cmd.Name); err != nil {
					tracef("SILENTLY IGNORING ERROR running ShowCommandHelp with %[1]q %[2]v", cmd.Name, err)
				}
			}
		}

		return ctx, err
	}

	if cmd.checkHelp() {
		return ctx, helpCommandAction(ctx, cmd)
	} else {
		tracef("no help is wanted (cmd=%[1]q)", cmd.Name)
	}

	if cmd.parent == nil && !cmd.HideVersion && checkVersion(cmd) {
		ShowVersion(cmd)
		return ctx, nil
	}

	for _, flag := range cmd.allFlags() {
		if err := flag.PostParse(); err != nil {
			return ctx, err
		}
	}

	if cmd.After != nil && !cmd.Root().shellCompletion {
		defer func() {
			if err := cmd.After(ctx, cmd); err != nil {
				err = cmd.handleExitCoder(ctx, err)

				if deferErr != nil {
					deferErr = newMultiError(deferErr, err)
				} else {
					deferErr = err
				}
			}
		}()
	}

	for _, grp := range cmd.MutuallyExclusiveFlags {
		if err := grp.check(cmd); err != nil {
			_ = ShowSubcommandHelp(cmd)
			return ctx, err
		}
	}

	var subCmd *Command
	if cmd.parsedArgs.Present() {
		tracef("checking positional args %[1]q (cmd=%[2]q)", cmd.parsedArgs, cmd.Name)

		name := cmd.parsedArgs.First()

		tracef("using first positional argument as sub-command name=%[1]q (cmd=%[2]q)", name, cmd.Name)

		if cmd.SuggestCommandFunc != nil && name != "--" {
			name = cmd.SuggestCommandFunc(cmd.Commands, name)
		}
		subCmd = cmd.Command(name)
		if subCmd == nil {
			hasDefault := cmd.DefaultCommand != ""
			isFlagName := slices.Contains(cmd.FlagNames(), name)

			if hasDefault {
				tracef("using default command=%[1]q (cmd=%[2]q)", cmd.DefaultCommand, cmd.Name)
			}

			if isFlagName || hasDefault {
				argsWithDefault := cmd.argsWithDefaultCommand(args)
				tracef("using default command args=%[1]q (cmd=%[2]q)", argsWithDefault, cmd.Name)
				if !reflect.DeepEqual(args, argsWithDefault) {
					subCmd = cmd.Command(argsWithDefault.First())
				}
			}
		}
	} else if cmd.parent == nil && cmd.DefaultCommand != "" {
		tracef("no positional args present; checking default command %[1]q (cmd=%[2]q)", cmd.DefaultCommand, cmd.Name)

		if dc := cmd.Command(cmd.DefaultCommand); dc != cmd {
			subCmd = dc
		}
	}

	// If a subcommand has been resolved, let it handle the remaining execution.
	if subCmd != nil {
		tracef("running sub-command %[1]q with arguments %[2]q (cmd=%[3]q)", subCmd.Name, cmd.Args(), cmd.Name)

		// It is important that we overwrite the ctx variable in the current
		// function so any defer'd functions use the new context returned
		// from the sub command.
		ctx, err = subCmd.run(ctx, cmd.Args().Slice())
		return ctx, err
	}

	// This code path is the innermost command execution. Here we actually
	// perform the command action.
	//
	// First, resolve the chain of nested commands up to the parent.
	var cmdChain []*Command
	for p := cmd; p != nil; p = p.parent {
		cmdChain = append(cmdChain, p)
	}
	slices.Reverse(cmdChain)

	// Run Before actions in order.
	for _, cmd := range cmdChain {
		if cmd.Before == nil {
			continue
		}
		if bctx, err := cmd.Before(ctx, cmd); err != nil {
			deferErr = cmd.handleExitCoder(ctx, err)
			return ctx, deferErr
		} else if bctx != nil {
			ctx = bctx
		}
	}

	// Run flag actions in order.
	// These take a context, so this has to happen after Before actions.
	for _, cmd := range cmdChain {
		tracef("running flag actions (cmd=%[1]q)", cmd.Name)
		if err := cmd.runFlagActions(ctx); err != nil {
			deferErr = cmd.handleExitCoder(ctx, err)
			return ctx, deferErr
		}
	}

	if err := cmd.checkAllRequiredFlags(); err != nil {
		cmd.isInError = true
		_ = ShowSubcommandHelp(cmd)
		return ctx, err
	}

	// Run the command action.
	if len(cmd.Arguments) > 0 {
		rargs := cmd.Args().Slice()
		tracef("calling argparse with %[1]v", rargs)
		for _, arg := range cmd.Arguments {
			var err error
			rargs, err = arg.Parse(rargs)
			if err != nil {
				tracef("calling with %[1]v (cmd=%[2]q)", err, cmd.Name)
				if cmd.OnUsageError != nil {
					err = cmd.OnUsageError(ctx, cmd, err, cmd.parent != nil)
				}
				err = cmd.handleExitCoder(ctx, err)
				return ctx, err
			}
		}
		cmd.parsedArgs = &stringSliceArgs{v: rargs}
	}

	if err := cmd.Action(ctx, cmd); err != nil {
		tracef("calling handleExitCoder with %[1]v (cmd=%[2]q)", err, cmd.Name)
		deferErr = cmd.handleExitCoder(ctx, err)
	}

	tracef("returning deferErr (cmd=%[1]q) %[2]q", cmd.Name, deferErr)
	return ctx, deferErr
}
