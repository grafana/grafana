package cli

import "sort"

// CommandCategories interface allows for category manipulation
type CommandCategories interface {
	// AddCommand adds a command to a category, creating a new category if necessary.
	AddCommand(category string, command *Command)
	// Categories returns a slice of categories sorted by name
	Categories() []CommandCategory
}

type commandCategories []*commandCategory

func newCommandCategories() CommandCategories {
	ret := commandCategories([]*commandCategory{})
	return &ret
}

func (c *commandCategories) Less(i, j int) bool {
	return lexicographicLess((*c)[i].Name(), (*c)[j].Name())
}

func (c *commandCategories) Len() int {
	return len(*c)
}

func (c *commandCategories) Swap(i, j int) {
	(*c)[i], (*c)[j] = (*c)[j], (*c)[i]
}

func (c *commandCategories) AddCommand(category string, command *Command) {
	for _, commandCategory := range []*commandCategory(*c) {
		if commandCategory.name == category {
			commandCategory.commands = append(commandCategory.commands, command)
			return
		}
	}
	newVal := append(*c,
		&commandCategory{name: category, commands: []*Command{command}})
	*c = newVal
}

func (c *commandCategories) Categories() []CommandCategory {
	ret := make([]CommandCategory, len(*c))
	for i, cat := range *c {
		ret[i] = cat
	}
	return ret
}

// CommandCategory is a category containing commands.
type CommandCategory interface {
	// Name returns the category name string
	Name() string
	// VisibleCommands returns a slice of the Commands with Hidden=false
	VisibleCommands() []*Command
}

type commandCategory struct {
	name     string
	commands []*Command
}

func (c *commandCategory) Name() string {
	return c.name
}

func (c *commandCategory) VisibleCommands() []*Command {
	if c.commands == nil {
		c.commands = []*Command{}
	}

	var ret []*Command
	for _, command := range c.commands {
		if !command.Hidden {
			ret = append(ret, command)
		}
	}
	return ret
}

// FlagCategories interface allows for category manipulation
type FlagCategories interface {
	// AddFlags adds a flag to a category, creating a new category if necessary.
	AddFlag(category string, fl Flag)
	// VisibleCategories returns a slice of visible flag categories sorted by name
	VisibleCategories() []VisibleFlagCategory
}

type defaultFlagCategories struct {
	m map[string]*defaultVisibleFlagCategory
}

func newFlagCategories() FlagCategories {
	return &defaultFlagCategories{
		m: map[string]*defaultVisibleFlagCategory{},
	}
}

func newFlagCategoriesFromFlags(fs []Flag) FlagCategories {
	fc := newFlagCategories()

	var categorized bool

	for _, fl := range fs {
		if cf, ok := fl.(CategorizableFlag); ok {
			visible := false
			if vf, ok := fl.(VisibleFlag); ok {
				visible = vf.IsVisible()
			}
			if cat := cf.GetCategory(); cat != "" && visible {
				fc.AddFlag(cat, fl)
				categorized = true
			}
		}
	}

	if categorized {
		for _, fl := range fs {
			if cf, ok := fl.(CategorizableFlag); ok {
				visible := false
				if vf, ok := fl.(VisibleFlag); ok {
					visible = vf.IsVisible()
				}
				if cf.GetCategory() == "" && visible {
					fc.AddFlag("", fl)
				}
			}
		}
	}

	return fc
}

func (f *defaultFlagCategories) AddFlag(category string, fl Flag) {
	if _, ok := f.m[category]; !ok {
		f.m[category] = &defaultVisibleFlagCategory{name: category, m: map[string]Flag{}}
	}

	f.m[category].m[fl.String()] = fl
}

func (f *defaultFlagCategories) VisibleCategories() []VisibleFlagCategory {
	catNames := []string{}
	for name := range f.m {
		catNames = append(catNames, name)
	}

	sort.Strings(catNames)

	ret := make([]VisibleFlagCategory, len(catNames))
	for i, name := range catNames {
		ret[i] = f.m[name]
	}

	return ret
}

// VisibleFlagCategory is a category containing flags.
type VisibleFlagCategory interface {
	// Name returns the category name string
	Name() string
	// Flags returns a slice of VisibleFlag sorted by name
	Flags() []Flag
}

type defaultVisibleFlagCategory struct {
	name string
	m    map[string]Flag
}

func (fc *defaultVisibleFlagCategory) Name() string {
	return fc.name
}

func (fc *defaultVisibleFlagCategory) Flags() []Flag {
	vfNames := []string{}
	for flName, fl := range fc.m {
		if vf, ok := fl.(VisibleFlag); ok {
			if vf.IsVisible() {
				vfNames = append(vfNames, flName)
			}
		}
	}

	sort.Strings(vfNames)

	ret := make([]Flag, len(vfNames))
	for i, flName := range vfNames {
		ret[i] = fc.m[flName]
	}

	return ret
}
