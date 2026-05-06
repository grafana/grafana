// Copyright 2012 Jesse van den Kieboom. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

/*
Package flags provides an extensive command line option parser.
The flags package is similar in functionality to the go built-in flag package
but provides more options and uses reflection to provide a convenient and
succinct way of specifying command line options.

# Supported features

The following features are supported in go-flags:

	Options with short names (-v)
	Options with long names (--verbose)
	Options with and without arguments (bool v.s. other type)
	Options with optional arguments and default values
	Option default values from ENVIRONMENT_VARIABLES, including slice and map values
	Multiple option groups each containing a set of options
	Generate and print well-formatted help message
	Passing remaining command line arguments after -- (optional)
	Ignoring unknown command line options (optional)
	Supports -I/usr/include -I=/usr/include -I /usr/include option argument specification
	Supports multiple short options -aux
	Supports all primitive go types (string, int{8..64}, uint{8..64}, float)
	Supports same option multiple times (can store in slice or last option counts)
	Supports maps
	Supports function callbacks
	Supports namespaces for (nested) option groups

Additional features specific to Windows:

	Options with short names (/v)
	Options with long names (/verbose)
	Windows-style options with arguments use a colon as the delimiter
	Modify generated help message with Windows-style / options
	Windows style options can be disabled at build time using the "forceposix"
	build tag

# Basic usage

The flags package uses structs, reflection and struct field tags
to allow users to specify command line options. This results in very simple
and concise specification of your application options. For example:

	type Options struct {
	    Verbose []bool `short:"v" long:"verbose" description:"Show verbose debug information"`
	}

This specifies one option with a short name -v and a long name --verbose.
When either -v or --verbose is found on the command line, a 'true' value
will be appended to the Verbose field. e.g. when specifying -vvv, the
resulting value of Verbose will be {[true, true, true]}.

Slice options work exactly the same as primitive type options, except that
whenever the option is encountered, a value is appended to the slice.

Map options from string to primitive type are also supported. On the command
line, you specify the value for such an option as key:value. For example

	type Options struct {
	    AuthorInfo string[string] `short:"a"`
	}

Then, the AuthorInfo map can be filled with something like
-a name:Jesse -a "surname:van den Kieboom".

Finally, for full control over the conversion between command line argument
values and options, user defined types can choose to implement the Marshaler
and Unmarshaler interfaces.

# Available field tags

The following is a list of tags for struct fields supported by go-flags:

	short:            the short name of the option (single character)
	long:             the long name of the option
	required:         if non empty, makes the option required to appear on the command
	                  line. If a required option is not present, the parser will
	                  return ErrRequired (optional)
	description:      the description of the option (optional)
	long-description: the long description of the option. Currently only
	                  displayed in generated man pages (optional)
	no-flag:          if non-empty, this field is ignored as an option (optional)

	optional:       if non-empty, makes the argument of the option optional. When an
	                argument is optional it can only be specified using
	                --option=argument (optional)
	optional-value: the value of an optional option when the option occurs
	                without an argument. This tag can be specified multiple
	                times in the case of maps or slices (optional)
	default:        the default value of an option. This tag can be specified
	                multiple times in the case of slices or maps (optional)
	default-mask:   when specified, this value will be displayed in the help
	                instead of the actual default value. This is useful
	                mostly for hiding otherwise sensitive information from
	                showing up in the help. If default-mask takes the special
	                value "-", then no default value will be shown at all
	                (optional)
	env:            the default value of the option is overridden from the
	                specified environment variable, if one has been defined.
	                (optional)
	env-delim:      the 'env' default value from environment is split into
	                multiple values with the given delimiter string, use with
	                slices and maps (optional)
	value-name:     the name of the argument value (to be shown in the help)
	                (optional)
	choice:         limits the values for an option to a set of values.
	                Repeat this tag once for each allowable value.
	                e.g. `long:"animal" choice:"cat" choice:"dog"`
	hidden:         if non-empty, the option is not visible in the help or man page.

	base: a base (radix) used to convert strings to integer values, the
	      default base is 10 (i.e. decimal) (optional)

	ini-name:       the explicit ini option name (optional)
	no-ini:         if non-empty this field is ignored as an ini option
	                (optional)

	group:                when specified on a struct field, makes the struct
	                      field a separate group with the given name (optional)
	namespace:            when specified on a group struct field, the namespace
	                      gets prepended to every option's long name and
	                      subgroup's namespace of this group, separated by
	                      the parser's namespace delimiter (optional)
	env-namespace:        when specified on a group struct field, the env-namespace
	                      gets prepended to every option's env key and
	                      subgroup's env-namespace of this group, separated by
	                      the parser's env-namespace delimiter (optional)
	command:              when specified on a struct field, makes the struct
	                      field a (sub)command with the given name (optional)
	subcommands-optional: when specified on a command struct field, makes
	                      any subcommands of that command optional (optional)
	alias:                when specified on a command struct field, adds the
	                      specified name as an alias for the command. Can be
	                      be specified multiple times to add more than one
	                      alias (optional)
	positional-args:      when specified on a field with a struct type,
	                      uses the fields of that struct to parse remaining
	                      positional command line arguments into (in order
	                      of the fields). If a field has a slice type,
	                      then all remaining arguments will be added to it.
	                      Positional arguments are optional by default,
	                      unless the "required" tag is specified together
	                      with the "positional-args" tag. The "required" tag
	                      can also be set on the individual rest argument
	                      fields, to require only the first N positional
	                      arguments. If the "required" tag is set on the
	                      rest arguments slice, then its value determines
	                      the minimum amount of rest arguments that needs to
	                      be provided (e.g. `required:"2"`) (optional)
	positional-arg-name:  used on a field in a positional argument struct; name
	                      of the positional argument placeholder to be shown in
	                      the help (optional)

Either the `short:` tag or the `long:` must be specified to make the field eligible as an
option.

# Option groups

Option groups are a simple way to semantically separate your options. All
options in a particular group are shown together in the help under the name
of the group. Namespaces can be used to specify option long names more
precisely and emphasize the options affiliation to their group.

There are currently three ways to specify option groups.

 1. Use NewNamedParser specifying the various option groups.
 2. Use AddGroup to add a group to an existing parser.
 3. Add a struct field to the top-level options annotated with the
    group:"group-name" tag.

# Commands

The flags package also has basic support for commands. Commands are often
used in monolithic applications that support various commands or actions.
Take git for example, all of the add, commit, checkout, etc. are called
commands. Using commands you can easily separate multiple functions of your
application.

There are currently two ways to specify a command.

 1. Use AddCommand on an existing parser.
 2. Add a struct field to your options struct annotated with the
    command:"command-name" tag.

The most common, idiomatic way to implement commands is to define a global
parser instance and implement each command in a separate file. These
command files should define a go init function which calls AddCommand on
the global parser.

When parsing ends and there is an active command and that command implements
the Commander interface, then its Execute method will be run with the
remaining command line arguments.

Command structs can have options which become valid to parse after the
command has been specified on the command line, in addition to the options
of all the parent commands. I.e. considering a -v flag on the parser and an
add command, the following are equivalent:

	./app -v add
	./app add -v

However, if the -v flag is defined on the add command, then the first of
the two examples above would fail since the -v flag is not defined before
the add command.

# Completion

go-flags has builtin support to provide bash completion of flags, commands
and argument values. To use completion, the binary which uses go-flags
can be invoked in a special environment to list completion of the current
command line argument. It should be noted that this `executes` your application,
and it is up to the user to make sure there are no negative side effects (for
example from init functions).

Setting the environment variable `GO_FLAGS_COMPLETION=1` enables completion
by replacing the argument parsing routine with the completion routine which
outputs completions for the passed arguments. The basic invocation to
complete a set of arguments is therefore:

	GO_FLAGS_COMPLETION=1 ./completion-example arg1 arg2 arg3

where `completion-example` is the binary, `arg1` and `arg2` are
the current arguments, and `arg3` (the last argument) is the argument
to be completed. If the GO_FLAGS_COMPLETION is set to "verbose", then
descriptions of possible completion items will also be shown, if there
are more than 1 completion items.

To use this with bash completion, a simple file can be written which
calls the binary which supports go-flags completion:

	_completion_example() {
	    # All arguments except the first one
	    args=("${COMP_WORDS[@]:1:$COMP_CWORD}")

	    # Only split on newlines
	    local IFS=$'\n'

	    # Call completion (note that the first element of COMP_WORDS is
	    # the executable itself)
	    COMPREPLY=($(GO_FLAGS_COMPLETION=1 ${COMP_WORDS[0]} "${args[@]}"))
	    return 0
	}

	complete -F _completion_example completion-example

Completion requires the parser option PassDoubleDash and is therefore enforced if the environment variable GO_FLAGS_COMPLETION is set.

Customized completion for argument values is supported by implementing
the flags.Completer interface for the argument value type. An example
of a type which does so is the flags.Filename type, an alias of string
allowing simple filename completion. A slice or array argument value
whose element type implements flags.Completer will also be completed.
*/
package flags
