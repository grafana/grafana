// Copyright 2012 Jesse van den Kieboom. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package flags

import (
	"errors"
	"reflect"
	"strings"
	"unicode/utf8"
)

// ErrNotPointerToStruct indicates that a provided data container is not
// a pointer to a struct. Only pointers to structs are valid data containers
// for options.
var ErrNotPointerToStruct = errors.New("provided data is not a pointer to struct")

// Group represents an option group. Option groups can be used to logically
// group options together under a description. Groups are only used to provide
// more structure to options both for the user (as displayed in the help message)
// and for you, since groups can be nested.
type Group struct {
	// A short description of the group. The
	// short description is primarily used in the built-in generated help
	// message
	ShortDescription string

	// A long description of the group. The long
	// description is primarily used to present information on commands
	// (Command embeds Group) in the built-in generated help and man pages.
	LongDescription string

	// The namespace of the group
	Namespace string

	// The environment namespace of the group
	EnvNamespace string

	// If true, the group is not displayed in the help or man page
	Hidden bool

	// The parent of the group or nil if it has no parent
	parent interface{}

	// All the options in the group
	options []*Option

	// All the subgroups
	groups []*Group

	// Whether the group represents the built-in help group
	isBuiltinHelp bool

	data interface{}
}

type scanHandler func(reflect.Value, *reflect.StructField) (bool, error)

// AddGroup adds a new group to the command with the given name and data. The
// data needs to be a pointer to a struct from which the fields indicate which
// options are in the group.
func (g *Group) AddGroup(shortDescription string, longDescription string, data interface{}) (*Group, error) {
	group := newGroup(shortDescription, longDescription, data)

	group.parent = g

	if err := group.scan(); err != nil {
		return nil, err
	}

	g.groups = append(g.groups, group)
	return group, nil
}

// AddOption adds a new option to this group.
func (g *Group) AddOption(option *Option, data interface{}) {
	option.value = reflect.ValueOf(data)
	option.group = g
	g.options = append(g.options, option)
}

// Groups returns the list of groups embedded in this group.
func (g *Group) Groups() []*Group {
	return g.groups
}

// Options returns the list of options in this group.
func (g *Group) Options() []*Option {
	return g.options
}

// Find locates the subgroup with the given short description and returns it.
// If no such group can be found Find will return nil. Note that the description
// is matched case insensitively.
func (g *Group) Find(shortDescription string) *Group {
	lshortDescription := strings.ToLower(shortDescription)

	var ret *Group

	g.eachGroup(func(gg *Group) {
		if gg != g && strings.ToLower(gg.ShortDescription) == lshortDescription {
			ret = gg
		}
	})

	return ret
}

func (g *Group) findOption(matcher func(*Option) bool) (option *Option) {
	g.eachGroup(func(g *Group) {
		for _, opt := range g.options {
			if option == nil && matcher(opt) {
				option = opt
			}
		}
	})

	return option
}

// FindOptionByLongName finds an option that is part of the group, or any of its
// subgroups, by matching its long name (including the option namespace).
func (g *Group) FindOptionByLongName(longName string) *Option {
	return g.findOption(func(option *Option) bool {
		return option.LongNameWithNamespace() == longName
	})
}

// FindOptionByShortName finds an option that is part of the group, or any of
// its subgroups, by matching its short name.
func (g *Group) FindOptionByShortName(shortName rune) *Option {
	return g.findOption(func(option *Option) bool {
		return option.ShortName == shortName
	})
}

func newGroup(shortDescription string, longDescription string, data interface{}) *Group {
	return &Group{
		ShortDescription: shortDescription,
		LongDescription:  longDescription,

		data: data,
	}
}

func (g *Group) optionByName(name string, namematch func(*Option, string) bool) *Option {
	prio := 0
	var retopt *Option

	g.eachGroup(func(g *Group) {
		for _, opt := range g.options {
			if namematch != nil && namematch(opt, name) && prio < 4 {
				retopt = opt
				prio = 4
			}

			if name == opt.field.Name && prio < 3 {
				retopt = opt
				prio = 3
			}

			if name == opt.LongNameWithNamespace() && prio < 2 {
				retopt = opt
				prio = 2
			}

			if opt.ShortName != 0 && name == string(opt.ShortName) && prio < 1 {
				retopt = opt
				prio = 1
			}
		}
	})

	return retopt
}

func (g *Group) showInHelp() bool {
	if g.Hidden {
		return false
	}
	for _, opt := range g.options {
		if opt.showInHelp() {
			return true
		}
	}
	return false
}

func (g *Group) eachGroup(f func(*Group)) {
	f(g)

	for _, gg := range g.groups {
		gg.eachGroup(f)
	}
}

func isStringFalsy(s string) bool {
	return s == "" || s == "false" || s == "no" || s == "0"
}

func (g *Group) scanStruct(realval reflect.Value, sfield *reflect.StructField, handler scanHandler) error {
	stype := realval.Type()

	if sfield != nil {
		if ok, err := handler(realval, sfield); err != nil {
			return err
		} else if ok {
			return nil
		}
	}

	for i := 0; i < stype.NumField(); i++ {
		field := stype.Field(i)

		// PkgName is set only for non-exported fields, which we ignore
		if field.PkgPath != "" && !field.Anonymous {
			continue
		}

		mtag := newMultiTag(string(field.Tag))

		if err := mtag.Parse(); err != nil {
			return err
		}

		// Skip fields with the no-flag tag
		if mtag.Get("no-flag") != "" {
			continue
		}

		// Dive deep into structs or pointers to structs
		kind := field.Type.Kind()
		fld := realval.Field(i)

		if kind == reflect.Struct {
			if err := g.scanStruct(fld, &field, handler); err != nil {
				return err
			}
		} else if kind == reflect.Ptr && field.Type.Elem().Kind() == reflect.Struct {
			flagCountBefore := len(g.options) + len(g.groups)

			if fld.IsNil() {
				fld = reflect.New(fld.Type().Elem())
			}

			if err := g.scanStruct(reflect.Indirect(fld), &field, handler); err != nil {
				return err
			}

			if len(g.options)+len(g.groups) != flagCountBefore {
				realval.Field(i).Set(fld)
			}
		}

		longname := mtag.Get("long")
		shortname := mtag.Get("short")

		// Need at least either a short or long name
		if longname == "" && shortname == "" && mtag.Get("ini-name") == "" {
			continue
		}

		short := rune(0)
		rc := utf8.RuneCountInString(shortname)

		if rc > 1 {
			return newErrorf(ErrShortNameTooLong,
				"short names can only be 1 character long, not `%s'",
				shortname)

		} else if rc == 1 {
			short, _ = utf8.DecodeRuneInString(shortname)
		}

		description := mtag.Get("description")
		def := mtag.GetMany("default")

		optionalValue := mtag.GetMany("optional-value")
		valueName := mtag.Get("value-name")
		defaultMask := mtag.Get("default-mask")

		optional := !isStringFalsy(mtag.Get("optional"))
		required := !isStringFalsy(mtag.Get("required"))
		choices := mtag.GetMany("choice")
		hidden := !isStringFalsy(mtag.Get("hidden"))

		option := &Option{
			Description:      description,
			ShortName:        short,
			LongName:         longname,
			Default:          def,
			EnvDefaultKey:    mtag.Get("env"),
			EnvDefaultDelim:  mtag.Get("env-delim"),
			OptionalArgument: optional,
			OptionalValue:    optionalValue,
			Required:         required,
			ValueName:        valueName,
			DefaultMask:      defaultMask,
			Choices:          choices,
			Hidden:           hidden,

			group: g,

			field: field,
			value: realval.Field(i),
			tag:   mtag,
		}

		if option.isBool() && option.Default != nil {
			return newErrorf(ErrInvalidTag,
				"boolean flag `%s' may not have default values, they always default to `false' and can only be turned on",
				option.shortAndLongName())
		}

		g.options = append(g.options, option)
	}

	return nil
}

func (g *Group) checkForDuplicateFlags() *Error {
	shortNames := make(map[rune]*Option)
	longNames := make(map[string]*Option)

	var duplicateError *Error

	g.eachGroup(func(g *Group) {
		for _, option := range g.options {
			if option.LongName != "" {
				longName := option.LongNameWithNamespace()

				if otherOption, ok := longNames[longName]; ok {
					duplicateError = newErrorf(ErrDuplicatedFlag, "option `%s' uses the same long name as option `%s'", option, otherOption)
					return
				}
				longNames[longName] = option
			}
			if option.ShortName != 0 {
				if otherOption, ok := shortNames[option.ShortName]; ok {
					duplicateError = newErrorf(ErrDuplicatedFlag, "option `%s' uses the same short name as option `%s'", option, otherOption)
					return
				}
				shortNames[option.ShortName] = option
			}
		}
	})

	return duplicateError
}

func (g *Group) scanSubGroupHandler(realval reflect.Value, sfield *reflect.StructField) (bool, error) {
	mtag := newMultiTag(string(sfield.Tag))

	if err := mtag.Parse(); err != nil {
		return true, err
	}

	subgroup := mtag.Get("group")

	if len(subgroup) != 0 {
		var ptrval reflect.Value

		if realval.Kind() == reflect.Ptr {
			ptrval = realval

			if ptrval.IsNil() {
				ptrval.Set(reflect.New(ptrval.Type()))
			}
		} else {
			ptrval = realval.Addr()
		}

		description := mtag.Get("description")

		group, err := g.AddGroup(subgroup, description, ptrval.Interface())

		if err != nil {
			return true, err
		}

		group.Namespace = mtag.Get("namespace")
		group.EnvNamespace = mtag.Get("env-namespace")
		group.Hidden = mtag.Get("hidden") != ""

		return true, nil
	}

	return false, nil
}

func (g *Group) scanType(handler scanHandler) error {
	// Get all the public fields in the data struct
	ptrval := reflect.ValueOf(g.data)

	if ptrval.Type().Kind() != reflect.Ptr {
		panic(ErrNotPointerToStruct)
	}

	stype := ptrval.Type().Elem()

	if stype.Kind() != reflect.Struct {
		panic(ErrNotPointerToStruct)
	}

	realval := reflect.Indirect(ptrval)

	if err := g.scanStruct(realval, nil, handler); err != nil {
		return err
	}

	if err := g.checkForDuplicateFlags(); err != nil {
		return err
	}

	return nil
}

func (g *Group) scan() error {
	return g.scanType(g.scanSubGroupHandler)
}

func (g *Group) groupByName(name string) *Group {
	if len(name) == 0 {
		return g
	}

	return g.Find(name)
}
