package flags

import (
	"reflect"
	"sort"
	"strconv"
	"strings"
)

// Command represents an application command. Commands can be added to the
// parser (which itself is a command) and are selected/executed when its name
// is specified on the command line. The Command type embeds a Group and
// therefore also carries a set of command specific options.
type Command struct {
	// Embedded, see Group for more information
	*Group

	// The name by which the command can be invoked
	Name string

	// The active sub command (set by parsing) or nil
	Active *Command

	// Whether subcommands are optional
	SubcommandsOptional bool

	// Aliases for the command
	Aliases []string

	// Whether positional arguments are required
	ArgsRequired bool

	// Whether to pass all arguments after the first non option as remaining
	// command line arguments. This is equivalent to strict POSIX processing.
	// This is command-local version of PassAfterNonOption Parser flag. It
	// cannot be turned off when PassAfterNonOption Parser flag is set.
	PassAfterNonOption bool

	commands            []*Command
	hasBuiltinHelpGroup bool
	args                []*Arg
}

// Commander is an interface which can be implemented by any command added in
// the options. When implemented, the Execute method will be called for the last
// specified (sub)command providing the remaining command line arguments.
type Commander interface {
	// Execute will be called for the last active (sub)command. The
	// args argument contains the remaining command line arguments. The
	// error that Execute returns will be eventually passed out of the
	// Parse method of the Parser.
	Execute(args []string) error
}

// Usage is an interface which can be implemented to show a custom usage string
// in the help message shown for a command.
type Usage interface {
	// Usage is called for commands to allow customized printing of command
	// usage in the generated help message.
	Usage() string
}

type lookup struct {
	shortNames map[string]*Option
	longNames  map[string]*Option

	commands map[string]*Command
}

// AddCommand adds a new command to the parser with the given name and data. The
// data needs to be a pointer to a struct from which the fields indicate which
// options are in the command. The provided data can implement the Command and
// Usage interfaces.
func (c *Command) AddCommand(command string, shortDescription string, longDescription string, data interface{}) (*Command, error) {
	cmd := newCommand(command, shortDescription, longDescription, data)

	cmd.parent = c

	if err := cmd.scan(); err != nil {
		return nil, err
	}

	c.commands = append(c.commands, cmd)
	return cmd, nil
}

// AddGroup adds a new group to the command with the given name and data. The
// data needs to be a pointer to a struct from which the fields indicate which
// options are in the group.
func (c *Command) AddGroup(shortDescription string, longDescription string, data interface{}) (*Group, error) {
	group := newGroup(shortDescription, longDescription, data)

	group.parent = c

	if err := group.scanType(c.scanSubcommandHandler(group)); err != nil {
		return nil, err
	}

	c.groups = append(c.groups, group)
	return group, nil
}

// Commands returns a list of subcommands of this command.
func (c *Command) Commands() []*Command {
	return c.commands
}

// Find locates the subcommand with the given name and returns it. If no such
// command can be found Find will return nil.
func (c *Command) Find(name string) *Command {
	for _, cc := range c.commands {
		if cc.match(name) {
			return cc
		}
	}

	return nil
}

// FindOptionByLongName finds an option that is part of the command, or any of
// its parent commands, by matching its long name (including the option
// namespace).
func (c *Command) FindOptionByLongName(longName string) (option *Option) {
	for option == nil && c != nil {
		option = c.Group.FindOptionByLongName(longName)

		c, _ = c.parent.(*Command)
	}

	return option
}

// FindOptionByShortName finds an option that is part of the command, or any of
// its parent commands, by matching its long name (including the option
// namespace).
func (c *Command) FindOptionByShortName(shortName rune) (option *Option) {
	for option == nil && c != nil {
		option = c.Group.FindOptionByShortName(shortName)

		c, _ = c.parent.(*Command)
	}

	return option
}

// Args returns a list of positional arguments associated with this command.
func (c *Command) Args() []*Arg {
	ret := make([]*Arg, len(c.args))
	copy(ret, c.args)

	return ret
}

func newCommand(name string, shortDescription string, longDescription string, data interface{}) *Command {
	return &Command{
		Group: newGroup(shortDescription, longDescription, data),
		Name:  name,
	}
}

func (c *Command) scanSubcommandHandler(parentg *Group) scanHandler {
	f := func(realval reflect.Value, sfield *reflect.StructField) (bool, error) {
		mtag := newMultiTag(string(sfield.Tag))

		if err := mtag.Parse(); err != nil {
			return true, err
		}

		positional := mtag.Get("positional-args")

		if len(positional) != 0 {
			stype := realval.Type()

			for i := 0; i < stype.NumField(); i++ {
				field := stype.Field(i)

				m := newMultiTag((string(field.Tag)))

				if err := m.Parse(); err != nil {
					return true, err
				}

				name := m.Get("positional-arg-name")

				if len(name) == 0 {
					name = field.Name
				}

				required := -1
				requiredMaximum := -1

				sreq := m.Get("required")

				if sreq != "" {
					required = 1

					rng := strings.SplitN(sreq, "-", 2)

					if len(rng) > 1 {
						if preq, err := strconv.ParseInt(rng[0], 10, 32); err == nil {
							required = int(preq)
						}

						if preq, err := strconv.ParseInt(rng[1], 10, 32); err == nil {
							requiredMaximum = int(preq)
						}
					} else {
						if preq, err := strconv.ParseInt(sreq, 10, 32); err == nil {
							required = int(preq)
						}
					}
				}

				arg := &Arg{
					Name:            name,
					Description:     m.Get("description"),
					Required:        required,
					RequiredMaximum: requiredMaximum,

					value: realval.Field(i),
					tag:   m,
				}

				c.args = append(c.args, arg)

				if len(mtag.Get("required")) != 0 {
					c.ArgsRequired = true
				}
			}

			return true, nil
		}

		subcommand := mtag.Get("command")

		if len(subcommand) != 0 {
			var ptrval reflect.Value

			if realval.Kind() == reflect.Ptr {
				ptrval = realval

				if ptrval.IsNil() {
					ptrval.Set(reflect.New(ptrval.Type().Elem()))
				}
			} else {
				ptrval = realval.Addr()
			}

			shortDescription := mtag.Get("description")
			longDescription := mtag.Get("long-description")
			subcommandsOptional := mtag.Get("subcommands-optional")
			aliases := mtag.GetMany("alias")
			passAfterNonOption := mtag.Get("pass-after-non-option")

			subc, err := c.AddCommand(subcommand, shortDescription, longDescription, ptrval.Interface())

			if err != nil {
				return true, err
			}

			subc.Hidden = mtag.Get("hidden") != ""

			if len(subcommandsOptional) > 0 {
				subc.SubcommandsOptional = true
			}

			if len(aliases) > 0 {
				subc.Aliases = aliases
			}

			if len(passAfterNonOption) > 0 {
				subc.PassAfterNonOption = true
			}

			return true, nil
		}

		return parentg.scanSubGroupHandler(realval, sfield)
	}

	return f
}

func (c *Command) scan() error {
	return c.scanType(c.scanSubcommandHandler(c.Group))
}

func (c *Command) eachOption(f func(*Command, *Group, *Option)) {
	c.eachCommand(func(c *Command) {
		c.eachGroup(func(g *Group) {
			for _, option := range g.options {
				f(c, g, option)
			}
		})
	}, true)
}

func (c *Command) eachCommand(f func(*Command), recurse bool) {
	f(c)

	for _, cc := range c.commands {
		if recurse {
			cc.eachCommand(f, true)
		} else {
			f(cc)
		}
	}
}

func (c *Command) eachActiveGroup(f func(cc *Command, g *Group)) {
	c.eachGroup(func(g *Group) {
		f(c, g)
	})

	if c.Active != nil {
		c.Active.eachActiveGroup(f)
	}
}

func (c *Command) addHelpGroups(showHelp func() error) {
	if !c.hasBuiltinHelpGroup {
		c.addHelpGroup(showHelp)
		c.hasBuiltinHelpGroup = true
	}

	for _, cc := range c.commands {
		cc.addHelpGroups(showHelp)
	}
}

func (c *Command) makeLookup() lookup {
	ret := lookup{
		shortNames: make(map[string]*Option),
		longNames:  make(map[string]*Option),
		commands:   make(map[string]*Command),
	}

	parent := c.parent

	var parents []*Command

	for parent != nil {
		if cmd, ok := parent.(*Command); ok {
			parents = append(parents, cmd)
			parent = cmd.parent
		} else {
			parent = nil
		}
	}

	for i := len(parents) - 1; i >= 0; i-- {
		parents[i].fillLookup(&ret, true)
	}

	c.fillLookup(&ret, false)
	return ret
}

func (c *Command) fillLookup(ret *lookup, onlyOptions bool) {
	c.eachGroup(func(g *Group) {
		for _, option := range g.options {
			if option.ShortName != 0 {
				ret.shortNames[string(option.ShortName)] = option
			}

			if len(option.LongName) > 0 {
				ret.longNames[option.LongNameWithNamespace()] = option
			}
		}
	})

	if onlyOptions {
		return
	}

	for _, subcommand := range c.commands {
		ret.commands[subcommand.Name] = subcommand

		for _, a := range subcommand.Aliases {
			ret.commands[a] = subcommand
		}
	}
}

func (c *Command) groupByName(name string) *Group {
	if grp := c.Group.groupByName(name); grp != nil {
		return grp
	}

	for _, subc := range c.commands {
		prefix := subc.Name + "."

		if strings.HasPrefix(name, prefix) {
			if grp := subc.groupByName(name[len(prefix):]); grp != nil {
				return grp
			}
		} else if name == subc.Name {
			return subc.Group
		}
	}

	return nil
}

type commandList []*Command

func (c commandList) Less(i, j int) bool {
	return c[i].Name < c[j].Name
}

func (c commandList) Len() int {
	return len(c)
}

func (c commandList) Swap(i, j int) {
	c[i], c[j] = c[j], c[i]
}

func (c *Command) sortedVisibleCommands() []*Command {
	ret := commandList(c.visibleCommands())
	sort.Sort(ret)

	return []*Command(ret)
}

func (c *Command) visibleCommands() []*Command {
	ret := make([]*Command, 0, len(c.commands))

	for _, cmd := range c.commands {
		if !cmd.Hidden {
			ret = append(ret, cmd)
		}
	}

	return ret
}

func (c *Command) match(name string) bool {
	if c.Name == name {
		return true
	}

	for _, v := range c.Aliases {
		if v == name {
			return true
		}
	}

	return false
}

func (c *Command) hasHelpOptions() bool {
	ret := false

	c.eachGroup(func(g *Group) {
		if g.isBuiltinHelp {
			return
		}

		for _, opt := range g.options {
			if opt.showInHelp() {
				ret = true
			}
		}
	})

	return ret
}

func (c *Command) fillParseState(s *parseState) {
	s.positional = make([]*Arg, len(c.args))
	copy(s.positional, c.args)

	s.lookup = c.makeLookup()
	s.command = c
}
