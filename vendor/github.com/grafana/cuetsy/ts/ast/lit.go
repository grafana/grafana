package ast

import (
	"fmt"
	"sort"
	"strings"
)

type ObjectLit struct {
	Comment []Comment
	Elems   []KeyValueExpr
	IsType  bool
	IsMap   bool

	eol EOL
	lvl int
}

func (o ObjectLit) Comments() []Comment {
	return o.Comment
}
func (o ObjectLit) expr() {}
func (o ObjectLit) String() string {
	if len(o.eol) == 0 {
		return o.innerString(EOLComma, o.lvl)
	}
	return o.innerString(o.eol, o.lvl)
}

func (o ObjectLit) innerString(aeol EOL, lvl int) string {
	lvl++
	eol := string(aeol) + "\n"

	var b strings.Builder
	write := b.WriteString
	indent := func(n int) {
		write(strings.Repeat(Indent, n))
	}

	if o.IsMap {
		kv := o.Elems[0]
		write(fmt.Sprintf("Record<%s, %s>", kv.Key.String(), kv.Value.String()))
		return b.String()
	}

	if len(o.Elems) == 0 {
		if o.IsType {
			write("Record<string, unknown>")
		} else {
			write("{}")
		}
		return b.String()
	}

	write("{\n")
	for _, e := range o.Elems {
		hasInlineComments := false
		for _, c := range e.Comments() {
			if c.Pos == CommentInline {
				hasInlineComments = true
			}
		}
		indent(lvl)
		write(formatInner(aeol, lvl, e))
		if hasInlineComments {
			write("\n")
		} else {
			write(eol)
		}

	}

	indent(lvl - 1)
	write("}")

	return b.String()
}

func format(n Node) string {
	return formatInner(EOLSemicolon, 0, n)
}

// formatInner prints an ast Node with eol sensitivity and indentation leveling.
func formatInner(eol EOL, lvl int, n Node) string {
	prinner := func(eol EOL, lvl int, n fmt.Stringer) string {
		if x, ok := n.(innerStringer); ok {
			return x.innerString(eol, lvl)
		}
		return n.String()
	}

	com, is := n.(Commenter)
	if !is || len(com.Comments()) == 0 {
		return prinner(eol, lvl, n)
	}
	var b strings.Builder

	comms := com.Comments()
	sort.SliceStable(comms, func(i, j int) bool {
		return comms[i].Pos < comms[j].Pos
	})

	var i int
	for ; i < len(comms) && comms[i].Pos == CommentAbove; i++ {
		b.WriteString(comms[i].innerString(eol, lvl))
		b.WriteString("\n" + strings.Repeat(Indent, lvl))
	}
	b.WriteString(prinner(eol, lvl, n))

	for ; i < len(comms) && comms[i].Pos == CommentInline; i++ {
		if _, ok := n.(KeyValueExpr); ok {
			b.WriteString("; " + comms[i].innerString(eol, lvl))
		} else {
			b.WriteString(" " + comms[i].innerString(eol, lvl))
		}
	}

	for ; i < len(comms); i++ {
		b.WriteString(comms[i].innerString(eol, lvl))
		b.WriteString("\n" + strings.Repeat(Indent, lvl))
	}

	return b.String()
}

type ListLit struct {
	Elems []Expr
}

func (l ListLit) expr() {}
func (l ListLit) String() string {
	return l.innerString(EOLComma, 0)
}

func (l ListLit) innerString(eol EOL, lvl int) string {
	strs := make([]string, len(l.Elems))
	for i, e := range l.Elems {
		strs[i] = formatInner(eol, lvl, e)
	}
	return string(SquareBrack[0]) + strings.Join(strs, ", ") + string(SquareBrack[1])
}

// TODO: combine InterfaceType, EnumType, ListLit and ObjectLit rendering into below
// type CompositeLit struct {}
