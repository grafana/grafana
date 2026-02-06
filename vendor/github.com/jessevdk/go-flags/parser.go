// Copyright 2012 Jesse van den Kieboom. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package flags

import (
	"bytes"
	"fmt"
	"os"
	"path"
	"reflect"
	"sort"
	"strings"
	"unicode/utf8"
)

// A Parser provides command line option parsing. It can contain several
// option groups each with their own set of options.
type Parser struct {
	// Embedded, see Command for more information
	*Command

	// A usage string to be displayed in the help message.
	Usage string

	// Option flags changing the behavior of the parser.
	Options Options

	// NamespaceDelimiter separates group namespaces and option long names
	NamespaceDelimiter string

	// EnvNamespaceDelimiter separates group env namespaces and env keys
	EnvNamespaceDelimiter string

	// UnknownOptionsHandler is a function which gets called when the parser
	// encounters an unknown option. The function receives the unknown option
	// name, a SplitArgument which specifies its value if set with an argument
	// separator, and the remaining command line arguments.
	// It should return a new list of remaining arguments to continue parsing,
	// or an error to indicate a parse failure.
	UnknownOptionHandler func(option string, arg SplitArgument, args []string) ([]string, error)

	// CompletionHandler is a function gets called to handle the completion of
	// items. By default, the items are printed and the application is exited.
	// You can override this default behavior by specifying a custom CompletionHandler.
	CompletionHandler func(items []Completion)

	// CommandHandler is a function that gets called to handle execution of a
	// command. By default, the command will simply be executed. This can be
	// overridden to perform certain actions (such as applying global flags)
	// just before the command is executed. Note that if you override the
	// handler it is your responsibility to call the command.Execute function.
	//
	// The command passed into CommandHandler may be nil in case there is no
	// command to be executed when parsing has finished.
	CommandHandler func(command Commander, args []string) error

	internalError error
}

// SplitArgument represents the argument value of an option that was passed using
// an argument separator.
type SplitArgument interface {
	// String returns the option's value as a string, and a boolean indicating
	// if the option was present.
	Value() (string, bool)
}

type strArgument struct {
	value *string
}

func (s strArgument) Value() (string, bool) {
	if s.value == nil {
		return "", false
	}

	return *s.value, true
}

// Options provides parser options that change the behavior of the option
// parser.
type Options uint

const (
	// None indicates no options.
	None Options = 0

	// HelpFlag adds a default Help Options group to the parser containing
	// -h and --help options. When either -h or --help is specified on the
	// command line, the parser will return the special error of type
	// ErrHelp. When PrintErrors is also specified, then the help message
	// will also be automatically printed to os.Stdout.
	HelpFlag = 1 << iota

	// PassDoubleDash passes all arguments after a double dash, --, as
	// remaining command line arguments (i.e. they will not be parsed for
	// flags).
	PassDoubleDash

	// IgnoreUnknown ignores any unknown options and passes them as
	// remaining command line arguments instead of generating an error.
	IgnoreUnknown

	// PrintErrors prints any errors which occurred during parsing to
	// os.Stderr. In the special case of ErrHelp, the message will be printed
	// to os.Stdout.
	PrintErrors

	// PassAfterNonOption passes all arguments after the first non option
	// as remaining command line arguments. This is equivalent to strict
	// POSIX processing.
	PassAfterNonOption

	// AllowBoolValues allows a user to assign true/false to a boolean value
	// rather than raising an error stating it cannot have an argument.
	AllowBoolValues

	// Default is a convenient default set of options which should cover
	// most of the uses of the flags package.
	Default = HelpFlag | PrintErrors | PassDoubleDash
)

type parseState struct {
	arg        string
	args       []string
	retargs    []string
	positional []*Arg
	err        error

	command *Command
	lookup  lookup
}

// Parse is a convenience function to parse command line options with default
// settings. The provided data is a pointer to a struct representing the
// default option group (named "Application Options"). For more control, use
// flags.NewParser.
func Parse(data interface{}) ([]string, error) {
	return NewParser(data, Default).Parse()
}

// ParseArgs is a convenience function to parse command line options with default
// settings. The provided data is a pointer to a struct representing the
// default option group (named "Application Options"). The args argument is
// the list of command line arguments to parse. If you just want to parse the
// default program command line arguments (i.e. os.Args), then use flags.Parse
// instead. For more control, use flags.NewParser.
func ParseArgs(data interface{}, args []string) ([]string, error) {
	return NewParser(data, Default).ParseArgs(args)
}

// NewParser creates a new parser. It uses os.Args[0] as the application
// name and then calls Parser.NewNamedParser (see Parser.NewNamedParser for
// more details). The provided data is a pointer to a struct representing the
// default option group (named "Application Options"), or nil if the default
// group should not be added. The options parameter specifies a set of options
// for the parser.
func NewParser(data interface{}, options Options) *Parser {
	p := NewNamedParser(path.Base(os.Args[0]), options)

	if data != nil {
		g, err := p.AddGroup("Application Options", "", data)

		if err == nil {
			g.parent = p
		}

		p.internalError = err
	}

	return p
}

// NewNamedParser creates a new parser. The appname is used to display the
// executable name in the built-in help message. Option groups and commands can
// be added to this parser by using AddGroup and AddCommand.
func NewNamedParser(appname string, options Options) *Parser {
	p := &Parser{
		Command:               newCommand(appname, "", "", nil),
		Options:               options,
		NamespaceDelimiter:    ".",
		EnvNamespaceDelimiter: "_",
	}

	p.Command.parent = p

	return p
}

// Parse parses the command line arguments from os.Args using Parser.ParseArgs.
// For more detailed information see ParseArgs.
func (p *Parser) Parse() ([]string, error) {
	return p.ParseArgs(os.Args[1:])
}

// ParseArgs parses the command line arguments according to the option groups that
// were added to the parser. On successful parsing of the arguments, the
// remaining, non-option, arguments (if any) are returned. The returned error
// indicates a parsing error and can be used with PrintError to display
// contextual information on where the error occurred exactly.
//
// When the common help group has been added (AddHelp) and either -h or --help
// was specified in the command line arguments, a help message will be
// automatically printed if the PrintErrors option is enabled.
// Furthermore, the special error type ErrHelp is returned.
// It is up to the caller to exit the program if so desired.
func (p *Parser) ParseArgs(args []string) ([]string, error) {
	if p.internalError != nil {
		return nil, p.internalError
	}

	p.eachOption(func(c *Command, g *Group, option *Option) {
		option.clearReferenceBeforeSet = true
		option.updateDefaultLiteral()
	})

	// Add built-in help group to all commands if necessary
	if (p.Options & HelpFlag) != None {
		p.addHelpGroups(p.showBuiltinHelp)
	}

	compval := os.Getenv("GO_FLAGS_COMPLETION")

	if len(compval) != 0 {
		comp := &completion{parser: p}
		items := comp.complete(args)

		if p.CompletionHandler != nil {
			p.CompletionHandler(items)
		} else {
			comp.print(items, compval == "verbose")
			os.Exit(0)
		}

		return nil, nil
	}

	s := &parseState{
		args:    args,
		retargs: make([]string, 0, len(args)),
	}

	p.fillParseState(s)

	for !s.eof() {
		var err error
		arg := s.pop()

		// When PassDoubleDash is set and we encounter a --, then
		// simply append all the rest as arguments and break out
		if (p.Options&PassDoubleDash) != None && arg == "--" {
			s.addArgs(s.args...)
			break
		}

		if !argumentIsOption(arg) {
			if ((p.Options&PassAfterNonOption) != None || s.command.PassAfterNonOption) && s.lookup.commands[arg] == nil {
				// If PassAfterNonOption is set then all remaining arguments
				// are considered positional
				if err = s.addArgs(s.arg); err != nil {
					break
				}

				if err = s.addArgs(s.args...); err != nil {
					break
				}

				break
			}

			// Note: this also sets s.err, so we can just check for
			// nil here and use s.err later
			if p.parseNonOption(s) != nil {
				break
			}

			continue
		}

		prefix, optname, islong := stripOptionPrefix(arg)
		optname, _, argument := splitOption(prefix, optname, islong)

		if islong {
			err = p.parseLong(s, optname, argument)
		} else {
			err = p.parseShort(s, optname, argument)
		}

		if err != nil {
			ignoreUnknown := (p.Options & IgnoreUnknown) != None
			parseErr := wrapError(err)

			if parseErr.Type != ErrUnknownFlag || (!ignoreUnknown && p.UnknownOptionHandler == nil) {
				s.err = parseErr
				break
			}

			if ignoreUnknown {
				s.addArgs(arg)
			} else if p.UnknownOptionHandler != nil {
				modifiedArgs, err := p.UnknownOptionHandler(optname, strArgument{argument}, s.args)

				if err != nil {
					s.err = err
					break
				}

				s.args = modifiedArgs
			}
		}
	}

	if s.err == nil {
		p.eachOption(func(c *Command, g *Group, option *Option) {
			err := option.clearDefault()
			if err != nil {
				if _, ok := err.(*Error); !ok {
					err = p.marshalError(option, err)
				}
				s.err = err
			}
		})

		s.checkRequired(p)
	}

	var reterr error

	if s.err != nil {
		reterr = s.err
	} else if len(s.command.commands) != 0 && !s.command.SubcommandsOptional {
		reterr = s.estimateCommand()
	} else if cmd, ok := s.command.data.(Commander); ok {
		if p.CommandHandler != nil {
			reterr = p.CommandHandler(cmd, s.retargs)
		} else {
			reterr = cmd.Execute(s.retargs)
		}
	} else if p.CommandHandler != nil {
		reterr = p.CommandHandler(nil, s.retargs)
	}

	if reterr != nil {
		var retargs []string

		if ourErr, ok := reterr.(*Error); !ok || ourErr.Type != ErrHelp {
			retargs = append([]string{s.arg}, s.args...)
		} else {
			retargs = s.args
		}

		return retargs, p.printError(reterr)
	}

	return s.retargs, nil
}

func (p *parseState) eof() bool {
	return len(p.args) == 0
}

func (p *parseState) pop() string {
	if p.eof() {
		return ""
	}

	p.arg = p.args[0]
	p.args = p.args[1:]

	return p.arg
}

func (p *parseState) peek() string {
	if p.eof() {
		return ""
	}

	return p.args[0]
}

func (p *parseState) checkRequired(parser *Parser) error {
	c := parser.Command

	var required []*Option

	for c != nil {
		c.eachGroup(func(g *Group) {
			for _, option := range g.options {
				if !option.isSet && option.Required {
					required = append(required, option)
				}
			}
		})

		c = c.Active
	}

	if len(required) == 0 {
		if len(p.positional) > 0 {
			var reqnames []string

			for _, arg := range p.positional {
				argRequired := (!arg.isRemaining() && p.command.ArgsRequired) || arg.Required != -1 || arg.RequiredMaximum != -1

				if !argRequired {
					continue
				}

				if arg.isRemaining() {
					if arg.value.Len() < arg.Required {
						var arguments string

						if arg.Required > 1 {
							arguments = "arguments, but got only " + fmt.Sprintf("%d", arg.value.Len())
						} else {
							arguments = "argument"
						}

						reqnames = append(reqnames, "`"+arg.Name+" (at least "+fmt.Sprintf("%d", arg.Required)+" "+arguments+")`")
					} else if arg.RequiredMaximum != -1 && arg.value.Len() > arg.RequiredMaximum {
						if arg.RequiredMaximum == 0 {
							reqnames = append(reqnames, "`"+arg.Name+" (zero arguments)`")
						} else {
							var arguments string

							if arg.RequiredMaximum > 1 {
								arguments = "arguments, but got " + fmt.Sprintf("%d", arg.value.Len())
							} else {
								arguments = "argument"
							}

							reqnames = append(reqnames, "`"+arg.Name+" (at most "+fmt.Sprintf("%d", arg.RequiredMaximum)+" "+arguments+")`")
						}
					}
				} else {
					reqnames = append(reqnames, "`"+arg.Name+"`")
				}
			}

			if len(reqnames) == 0 {
				return nil
			}

			var msg string

			if len(reqnames) == 1 {
				msg = fmt.Sprintf("the required argument %s was not provided", reqnames[0])
			} else {
				msg = fmt.Sprintf("the required arguments %s and %s were not provided",
					strings.Join(reqnames[:len(reqnames)-1], ", "), reqnames[len(reqnames)-1])
			}

			p.err = newError(ErrRequired, msg)
			return p.err
		}

		return nil
	}

	names := make([]string, 0, len(required))

	for _, k := range required {
		names = append(names, "`"+k.String()+"'")
	}

	sort.Strings(names)

	var msg string

	if len(names) == 1 {
		msg = fmt.Sprintf("the required flag %s was not specified", names[0])
	} else {
		msg = fmt.Sprintf("the required flags %s and %s were not specified",
			strings.Join(names[:len(names)-1], ", "), names[len(names)-1])
	}

	p.err = newError(ErrRequired, msg)
	return p.err
}

func (p *parseState) estimateCommand() error {
	commands := p.command.sortedVisibleCommands()
	cmdnames := make([]string, len(commands))

	for i, v := range commands {
		cmdnames[i] = v.Name
	}

	var msg string
	var errtype ErrorType

	if len(p.retargs) != 0 {
		c, l := closestChoice(p.retargs[0], cmdnames)
		msg = fmt.Sprintf("Unknown command `%s'", p.retargs[0])
		errtype = ErrUnknownCommand

		if float32(l)/float32(len(c)) < 0.5 {
			msg = fmt.Sprintf("%s, did you mean `%s'?", msg, c)
		} else if len(cmdnames) == 1 {
			msg = fmt.Sprintf("%s. You should use the %s command",
				msg,
				cmdnames[0])
		} else if len(cmdnames) > 1 {
			msg = fmt.Sprintf("%s. Please specify one command of: %s or %s",
				msg,
				strings.Join(cmdnames[:len(cmdnames)-1], ", "),
				cmdnames[len(cmdnames)-1])
		}
	} else {
		errtype = ErrCommandRequired

		if len(cmdnames) == 1 {
			msg = fmt.Sprintf("Please specify the %s command", cmdnames[0])
		} else if len(cmdnames) > 1 {
			msg = fmt.Sprintf("Please specify one command of: %s or %s",
				strings.Join(cmdnames[:len(cmdnames)-1], ", "),
				cmdnames[len(cmdnames)-1])
		}
	}

	return newError(errtype, msg)
}

func (p *Parser) parseOption(s *parseState, name string, option *Option, canarg bool, argument *string) (err error) {
	if !option.canArgument() {
		if argument != nil && (p.Options&AllowBoolValues) == None {
			return newErrorf(ErrNoArgumentForBool, "bool flag `%s' cannot have an argument", option)
		}
		err = option.Set(argument)
	} else if argument != nil || (canarg && !s.eof()) {
		var arg string

		if argument != nil {
			arg = *argument
		} else {
			arg = s.pop()

			if validationErr := option.isValidValue(arg); validationErr != nil {
				return newErrorf(ErrExpectedArgument, validationErr.Error())
			} else if p.Options&PassDoubleDash != 0 && arg == "--" {
				return newErrorf(ErrExpectedArgument, "expected argument for flag `%s', but got double dash `--'", option)
			}
		}

		if option.tag.Get("unquote") != "false" {
			arg, err = unquoteIfPossible(arg)
		}

		if err == nil {
			err = option.Set(&arg)
		}
	} else if option.OptionalArgument {
		option.empty()

		for _, v := range option.OptionalValue {
			err = option.Set(&v)

			if err != nil {
				break
			}
		}
	} else {
		err = newErrorf(ErrExpectedArgument, "expected argument for flag `%s'", option)
	}

	if err != nil {
		if _, ok := err.(*Error); !ok {
			err = p.marshalError(option, err)
		}
	}

	return err
}

func (p *Parser) marshalError(option *Option, err error) *Error {
	s := "invalid argument for flag `%s'"

	expected := p.expectedType(option)

	if expected != "" {
		s = s + " (expected " + expected + ")"
	}

	return newErrorf(ErrMarshal, s+": %s",
		option,
		err.Error())
}

func (p *Parser) expectedType(option *Option) string {
	valueType := option.value.Type()

	if valueType.Kind() == reflect.Func {
		return ""
	}

	return valueType.String()
}

func (p *Parser) parseLong(s *parseState, name string, argument *string) error {
	if option := s.lookup.longNames[name]; option != nil {
		// Only long options that are required can consume an argument
		// from the argument list
		canarg := !option.OptionalArgument

		return p.parseOption(s, name, option, canarg, argument)
	}

	return newErrorf(ErrUnknownFlag, "unknown flag `%s'", name)
}

func (p *Parser) splitShortConcatArg(s *parseState, optname string) (string, *string) {
	c, n := utf8.DecodeRuneInString(optname)

	if n == len(optname) {
		return optname, nil
	}

	first := string(c)

	if option := s.lookup.shortNames[first]; option != nil && option.canArgument() {
		arg := optname[n:]
		return first, &arg
	}

	return optname, nil
}

func (p *Parser) parseShort(s *parseState, optname string, argument *string) error {
	if argument == nil {
		optname, argument = p.splitShortConcatArg(s, optname)
	}

	for i, c := range optname {
		shortname := string(c)

		if option := s.lookup.shortNames[shortname]; option != nil {
			// Only the last short argument can consume an argument from
			// the arguments list, and only if it's non optional
			canarg := (i+utf8.RuneLen(c) == len(optname)) && !option.OptionalArgument

			if err := p.parseOption(s, shortname, option, canarg, argument); err != nil {
				return err
			}
		} else {
			return newErrorf(ErrUnknownFlag, "unknown flag `%s'", shortname)
		}

		// Only the first option can have a concatted argument, so just
		// clear argument here
		argument = nil
	}

	return nil
}

func (p *parseState) addArgs(args ...string) error {
	for len(p.positional) > 0 && len(args) > 0 {
		arg := p.positional[0]

		if err := convert(args[0], arg.value, arg.tag); err != nil {
			p.err = err
			return err
		}

		if !arg.isRemaining() {
			p.positional = p.positional[1:]
		}

		args = args[1:]
	}

	p.retargs = append(p.retargs, args...)
	return nil
}

func (p *Parser) parseNonOption(s *parseState) error {
	if len(s.positional) > 0 {
		return s.addArgs(s.arg)
	}

	if len(s.command.commands) > 0 && len(s.retargs) == 0 {
		if cmd := s.lookup.commands[s.arg]; cmd != nil {
			s.command.Active = cmd
			cmd.fillParseState(s)

			return nil
		} else if !s.command.SubcommandsOptional {
			s.addArgs(s.arg)
			return newErrorf(ErrUnknownCommand, "Unknown command `%s'", s.arg)
		}
	}

	return s.addArgs(s.arg)
}

func (p *Parser) showBuiltinHelp() error {
	var b bytes.Buffer

	p.WriteHelp(&b)
	return newError(ErrHelp, b.String())
}

func (p *Parser) printError(err error) error {
	if err != nil && (p.Options&PrintErrors) != None {
		flagsErr, ok := err.(*Error)

		if ok && flagsErr.Type == ErrHelp {
			fmt.Fprintln(os.Stdout, err)
		} else {
			fmt.Fprintln(os.Stderr, err)
		}
	}

	return err
}
