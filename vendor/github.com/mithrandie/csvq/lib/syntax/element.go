package syntax

import (
	"fmt"
	"strings"

	"github.com/mithrandie/csvq/lib/option"

	"github.com/mithrandie/go-text/color"
)

const (
	NameEffect     = "syntax_name"
	KeywordEffect  = "syntax_keyword"
	LinkEffect     = "syntax_link"
	VariableEffect = "syntax_variable"
	FlagEffect     = "syntax_flag"
	ItalicEffect   = "syntax_italic"
	TypeEffect     = "syntax_type"
)

type Definition struct {
	Name        Name
	Group       []Grammar
	Description Description
}

type Element interface {
	Format(p *color.Palette) string
}

type Name string

func (e Name) String() string {
	return string(e)
}

func (e Name) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(NameEffect, s)
	}
	return s
}

type Grammar []Element

func (e Grammar) Format(p *color.Palette) string {
	l := make([]string, 0, len(e))
	for _, en := range e {
		l = append(l, en.Format(p))
	}
	return strings.Join(l, " ")
}

type Description struct {
	Template string
	Values   []Element
}

func (e Description) Format(p *color.Palette) string {
	var decorateRequired = func(e Element) bool {
		switch e.(type) {
		case String, Integer, Float, Boolean, Datetime, Identifier:
			return true
		case Ternary:
			s := string(e.(Ternary))
			if s == "TRUE" || s == "FALSE" || s == "UNKNOWN" {
				return false
			}
			return true
		case Null:
			s := string(e.(Null))
			if s == "NULL" {
				return false
			}
			return true
		}
		return false
	}

	replaces := make([]interface{}, 0, len(e.Values))
	for _, v := range e.Values {
		if p == nil && decorateRequired(v) {
			replaces = append(replaces, "_"+v.Format(p)+"_")
		} else {
			replaces = append(replaces, v.Format(p))
		}
	}
	return fmt.Sprintf(e.Template, replaces...)
}

type Keyword string

func (e Keyword) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(KeywordEffect, s)
	}
	return s
}

type Link string

func (e Link) Format(p *color.Palette) string {
	s := "<" + string(e) + ">"
	if p != nil {
		s = p.Render(LinkEffect, s)
	}
	return s
}

type Option []Element

func (e Option) Format(p *color.Palette) string {
	l := make([]string, 0, len(e))
	for _, v := range e {
		l = append(l, v.Format(p))
	}
	return "[" + strings.Join(l, " ") + "]"
}

type FollowingContinuousOption []Element

func (e FollowingContinuousOption) Format(p *color.Palette) string {
	l := make([]string, 0, len(e))
	for _, v := range e {
		l = append(l, v.Format(p))
	}
	return " [, " + strings.Join(l, " ") + " ...]"
}

type ContinuousOption []Element

func (e ContinuousOption) Format(p *color.Palette) string {
	l := make([]string, 0, len(e))
	for _, v := range e {
		l = append(l, v.Format(p))
	}
	return strings.Join(l, " ") + " [, " + strings.Join(l, " ") + " ...]"
}

type AnyOne []Element

func (e AnyOne) Format(p *color.Palette) string {
	l := make([]string, 0, len(e))
	for _, v := range e {
		l = append(l, v.Format(p))
	}
	return "{" + strings.Join(l, "|") + "}"
}

type Parentheses []Element

func (e Parentheses) Format(p *color.Palette) string {
	l := make([]string, 0, len(e))
	for _, v := range e {
		l = append(l, v.Format(p))
	}
	return "(" + strings.Join(l, " ") + ")"
}

type PlainGroup []Element

func (e PlainGroup) Format(p *color.Palette) string {
	l := make([]string, 0, len(e))
	for _, v := range e {
		l = append(l, v.Format(p))
	}
	return strings.Join(l, " ")
}

type ConnectedGroup []Element

func (e ConnectedGroup) Format(p *color.Palette) string {
	l := make([]string, 0, len(e))
	for _, v := range e {
		l = append(l, v.Format(p))
	}
	return strings.Join(l, "")
}

type Function struct {
	Name       string
	Args       []Element
	AfterArgs  []Element
	CustomArgs []Element
	Return     Element
}

func (e Function) Format(p *color.Palette) string {
	name := e.Name
	if p != nil {
		name = p.Render(KeywordEffect, name)
	}

	var fnargs string
	if 0 < len(e.CustomArgs) {
		args := make([]string, 0, len(e.CustomArgs))
		for _, v := range e.CustomArgs {
			args = append(args, formatArg(v, p))
		}
		fnargs = strings.Join(args, " ")
	} else {
		args := make([]string, 0, len(e.Args))
		var opstr string
		var prevOpt string
		for i, v := range e.Args {
			if op, ok := v.(Option); ok {
				if i == 0 {
					prevOpt = formatArg(v, p) + " "
				} else {
					for i := len(op) - 1; i >= 0; i-- {
						opstr = " [, " + formatArg(op[i], p) + opstr + "]"
					}
				}
			} else {
				args = append(args, formatArg(v, p))
			}
		}
		fnargs = prevOpt + strings.Join(args, ", ") + opstr
	}
	s := name + "(" + fnargs + ")"

	if e.AfterArgs != nil {
		afterArgs := make([]string, 0, len(e.AfterArgs))
		for _, arg := range e.AfterArgs {
			afterArgs = append(afterArgs, arg.Format(p))
		}
		s = s + " " + strings.Join(afterArgs, " ")
	}

	if e.Return != nil {
		s = s + e.Return.Format(p)
	}
	return s
}

func formatArg(arg Element, p *color.Palette) string {
	s := arg.Format(p)

	t := ""
	switch arg.(type) {
	case String:
		t = "string"
	case Integer:
		t = "integer"
	case Float:
		t = "float"
	case Boolean:
		t = "boolean"
	case Ternary:
		t = "ternary"
	case Datetime:
		t = "datetime"
	default:
		return s
	}
	t = "::" + t
	if p != nil {
		t = p.Render(TypeEffect, t)
	}
	return s + t
}

type ArgWithDefValue struct {
	Arg     Element
	Default Element
}

func (e ArgWithDefValue) Format(p *color.Palette) string {
	return formatArg(e.Arg, p) + " " + Keyword("DEFAULT").Format(p) + " " + e.Default.Format(p)
}

type String string

func (e String) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(ItalicEffect, p.Render(option.StringEffect, s))
	}
	return s
}

type Integer string

func (e Integer) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(ItalicEffect, p.Render(option.NumberEffect, s))
	}
	return s
}

type Float string

func (e Float) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(ItalicEffect, p.Render(option.NumberEffect, s))
	}
	return s
}

type Identifier string

func (e Identifier) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(option.IdentifierEffect, s)
	}
	return s
}

type Datetime string

func (e Datetime) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(ItalicEffect, p.Render(option.DatetimeEffect, s))
	}
	return s
}

type Boolean string

func (e Boolean) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(ItalicEffect, p.Render(option.BooleanEffect, s))
	}
	return s
}

type Ternary string

func (e Ternary) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(ItalicEffect, p.Render(option.TernaryEffect, s))
	}
	return s
}

type Null string

func (e Null) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(ItalicEffect, p.Render(option.NullEffect, s))
	}
	return s
}

type Variable string

func (e Variable) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(VariableEffect, s)
	}
	return s
}

type Flag string

func (e Flag) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(FlagEffect, s)
	}
	return s
}

type Token string

func (e Token) Format(_ *color.Palette) string {
	return string(e)
}

type Italic string

func (e Italic) Format(p *color.Palette) string {
	s := string(e)
	if p != nil {
		s = p.Render(ItalicEffect, s)
	}
	return s
}

type Return string

func (e Return) Format(p *color.Palette) string {
	s := "return::" + string(e)
	if p != nil {
		s = p.Render(TypeEffect, s)
	}
	return "  " + s
}
