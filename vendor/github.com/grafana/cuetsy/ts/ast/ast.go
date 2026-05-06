package ast

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

const Indent = "  "

type Brack string

const (
	RoundBrack  Brack = "()"
	SquareBrack Brack = "[]"
	CurlyBrack  Brack = "{}"
)

type Quot string

const (
	SingleQuot Quot = `'`
	DoubleQuot Quot = `"`
	BTickQuot  Quot = "`"
)

type EOL string

const (
	EOLNone      EOL = ""
	EOLComma     EOL = `,`
	EOLSemicolon EOL = `;`
)

type File struct {
	// file-level doc. Printed first at start of file, if non-nil
	Doc     *Comment
	Imports []ImportSpec
	Nodes   []Decl
}

func (f File) String() string {
	var b strings.Builder

	if f.Doc != nil {
		b.WriteString(f.Doc.String() + "\n\n")
	}

	for _, i := range f.Imports {
		b.WriteString(formatInner(EOLNone, 0, i))
		b.WriteString("\n")
	}

	if len(f.Imports) > 0 {
		b.WriteString("\n")
	}

	for i, n := range f.Nodes {
		b.WriteString(formatInner(EOLNone, 0, n))

		if i+1 < len(f.Nodes) {
			b.WriteString("\n\n")
		}
	}
	b.WriteString("\n")

	return b.String()
}

type Node interface {
	fmt.Stringer
}

type Commenter interface {
	Comments() []Comment
}

var (
	_ Commenter = KeyValueExpr{}
	_ Commenter = ObjectLit{}
	_ Commenter = VarDecl{}
	_ Commenter = TypeDecl{}
)

type innerStringer interface {
	innerString(eol EOL, lvl int) string
}

type Expr interface {
	Node
	expr()
}

type Decl interface {
	Node
	decl()
}

var (
	_ Expr = SelectorExpr{}
	_ Expr = IndexExpr{}
	_ Expr = Num{}
)

type Ident struct {
	Name string

	// TODO: factor out into asStmt?
	As string
}

var identRegexp = regexp.MustCompile("^[a-zA-Z_$][0-9a-zA-Z_$]*$")

var ErrBadIdent = errors.New("typescript idents must contain only alphanumeric characters")

func (i Ident) ident() {}
func (i Ident) expr()  {}
func (i Ident) String() string {
	n := strings.Replace(i.Name, "#", "", -1)

	if i.As != "" {
		return fmt.Sprintf("%s as %s", n, i.As)
	}
	return n
}

func (i Ident) Validate() error {
	if !identRegexp.MatchString(i.Name) {
		return ErrBadIdent
	}
	if i.As != "" && !identRegexp.MatchString(i.Name) {
		return ErrBadIdent
	}
	return nil
}

func None() Expr {
	return Ident{}
}

type Idents []Ident

func (i Idents) Strings() []string {
	strs := make([]string, len(i))
	for i, id := range i {
		strs[i] = id.String()
	}
	return strs
}

type Names struct {
	Brack
	Idents
}

func (n Names) String() string {
	switch len(n.Idents) {
	case 0:
		panic("Names.Idents must not be empty")
	case 1:
		return format(n.Idents[0])
	}

	b := n.Brack
	if b == "" {
		b = CurlyBrack
	}

	return fmt.Sprintf("%c%s%c", b[0], strings.Join(n.Idents.Strings(), ","), b[1])
}

type SelectorExpr struct {
	Expr Expr
	Sel  Ident
}

func (s SelectorExpr) expr() {}
func (s SelectorExpr) String() string {
	return fmt.Sprintf("%s.%s", s.Expr, s.Sel)
}

type IndexExpr struct {
	Expr  Expr
	Index Expr
}

func (i IndexExpr) expr() {}
func (i IndexExpr) String() string {
	return fmt.Sprintf("%s[%s]", i.Expr, i.Index)
}

type AssignExpr struct {
	Name  Ident
	Value Expr
}

func (a AssignExpr) expr() {}
func (a AssignExpr) String() string {
	return fmt.Sprintf("%s = %s", a.Name, a.Value)
}

type KeyValueExpr struct {
	Key         Expr
	Value       Expr
	CommentList []Comment
}

func (k KeyValueExpr) Comments() []Comment {
	return k.CommentList
}
func (k KeyValueExpr) expr() {}
func (k KeyValueExpr) String() string {
	return k.innerString(EOL(""), 0)
}

func (k KeyValueExpr) innerString(eol EOL, lvl int) string {
	return fmt.Sprintf("%s: %s", k.Key, formatInner(eol, lvl, k.Value))
}

type ParenExpr struct {
	Expr Expr
}

func (p ParenExpr) expr() {}
func (p ParenExpr) String() string {
	return p.innerString(EOL(""), 0)
}

func (p ParenExpr) innerString(eol EOL, lvl int) string {
	return fmt.Sprintf("(%s)", formatInner(eol, lvl, p.Expr))
}

type UnaryExpr struct {
	Op   string // operator
	Expr Expr   // operand
}

func (u UnaryExpr) expr() {}
func (u UnaryExpr) String() string {
	return u.Op + format(u.Expr)
}

type BinaryExpr struct {
	Op   string
	X, Y Expr
}

func (b BinaryExpr) expr() {}
func (b BinaryExpr) String() string {
	return fmt.Sprintf("%s %s %s", b.X, b.Op, b.Y)
}

func (b BinaryExpr) innerString(eol EOL, lvl int) string {
	return fmt.Sprintf("%s %s %s", formatInner(eol, lvl, b.X), b.Op, formatInner(eol, lvl+1, b.Y))
}

type TypeTransformExpr struct {
	Transform string // e.g. "Partial"
	Expr      Expr
}

func (tt TypeTransformExpr) expr() {}
func (tt TypeTransformExpr) String() string {
	return fmt.Sprintf("%s<%s>", tt.Transform, tt.Expr)
}

type Num struct {
	N   interface{}
	Fmt string
}

func (n Num) expr() {}
func (n Num) String() string {
	if n.Fmt == "" {
		return fmt.Sprintf("%v", n.N)
	}
	return fmt.Sprintf(n.Fmt, n.N)
}

type Str struct {
	Quot
	Value string
}

func (s Str) expr() {}
func (s Str) String() string {
	q := string(s.Quot)
	if q == "" {
		q = string(SingleQuot)

		if strings.Contains(s.Value, "\n") {
			q = string(BTickQuot)
		}
	}

	return q + s.Value + q
}

type VarDecl struct {
	Tok string

	Names
	Type        Expr
	Value       Expr
	CommentList []Comment
	Export      bool
}

func (v VarDecl) Comments() []Comment {
	return v.CommentList
}
func (v VarDecl) decl() {}
func (v VarDecl) String() string {
	tok := v.Tok
	if tok == "" {
		tok = "const"
	}
	b := new(strings.Builder)
	if v.Export {
		b.WriteString("export ")
	}
	fmt.Fprintf(b, "%s %s: %s = %s;", tok, v.Names, v.Type, v.Value)
	return b.String()
}

type Type interface {
	Node
	typeName() string
}

var (
	_ Type = EnumType{}
	_ Type = InterfaceType{}
	_ Type = BasicType{}
)

type TypeDecl struct {
	Name        Ident
	Type        Type
	CommentList []Comment
	Export      bool
}

func (t TypeDecl) Comments() []Comment {
	return t.CommentList
}
func (t TypeDecl) decl() {}
func (t TypeDecl) String() string {
	b := new(strings.Builder)
	if t.Export {
		b.WriteString("export ")
	}
	fmt.Fprintf(b, "%s %s %s", t.Type.typeName(), t.Name, t.Type)
	return b.String()
}

type BasicType struct {
	Expr Expr
}

func (b BasicType) typeName() string { return "type" }
func (b BasicType) String() string {
	return fmt.Sprintf("= %s;", b.Expr)
}

type EnumType struct {
	Elems []Expr
}

func (e EnumType) typeName() string { return "enum" }
func (e EnumType) String() string {
	var b strings.Builder
	b.WriteString("{")
	if len(e.Elems) > 0 {
		b.WriteString("\n")
	}
	for _, e := range e.Elems {
		b.WriteString(Indent)
		b.WriteString(format(e))
		b.WriteString(",\n")
	}
	b.WriteString("}")
	return b.String()
}

type InterfaceType struct {
	Elems   []KeyValueExpr
	Extends []Expr
}

func (i InterfaceType) typeName() string { return "interface" }
func (i InterfaceType) String() string {
	var b strings.Builder
	if len(i.Extends) > 0 {
		b.WriteString("extends ")
		for i, s := range i.Extends {
			if i != 0 {
				b.WriteString(", ")
			}
			b.WriteString(format(s))
		}
		b.WriteString(" ")
	}

	obj := ObjectLit{Elems: i.Elems, eol: EOLSemicolon}
	b.WriteString(format(obj))

	return b.String()
}

type ExportKeyword struct {
	Decl        Decl
	Default     bool
	CommentList []Comment
}

func (e ExportKeyword) Comments() []Comment {
	return e.CommentList
}
func (e ExportKeyword) decl() {}
func (e ExportKeyword) String() string {
	var b strings.Builder
	b.WriteString("export ")
	if e.Default {
		b.WriteString("default ")
	}
	b.WriteString(e.Decl.String())
	return b.String()
}

type ExportSet struct {
	TypeOnly    bool
	Exports     Idents
	From        Str
	CommentList []Comment
}

func (e ExportSet) Comments() []Comment {
	return e.CommentList
}
func (e ExportSet) decl() {}
func (e ExportSet) String() string {
	var b strings.Builder
	b.WriteString("export ")
	if e.TypeOnly {
		b.WriteString("type ")
	}
	switch len(e.Exports) {
	case 0:
		panic(fmt.Sprintf("ExportSet with 'from' %s contains no elements to export", e.From))
	case 1:
		fmt.Fprintf(&b, "{ %s }", e.Exports[0])
	default:
		strs := make([]string, 0, len(e.Exports))
		for _, elem := range e.Exports {
			strs = append(strs, elem.String())
		}
		fmt.Fprintf(&b, "{\n%s%s\n}", Indent, strings.Join(strs, ",\n"+Indent))
	}

	if e.From.Value != "" {
		fmt.Fprintf(&b, " from %s", e.From)
	}
	b.WriteString(string(EOLSemicolon))
	return b.String()
}

type ExportNamespace struct {
	AsName      string
	From        Str
	CommentList []Comment
}

func (e ExportNamespace) Comments() []Comment {
	return e.CommentList
}
func (e ExportNamespace) decl() {}
func (e ExportNamespace) String() string {
	var b strings.Builder
	b.WriteString("export * ")
	if e.AsName != "" {
		fmt.Fprintf(&b, "as %s ", e.AsName)
	}
	fmt.Fprintf(&b, "from %s%s", e.From, EOLSemicolon)
	return b.String()
}

// ListExpr represents lists in type definitions, like string[].
type ListExpr struct {
	Expr
}

func (l ListExpr) expr() {}
func (l ListExpr) String() string {
	return "Array<" + l.Expr.String() + ">"
}

func (l ListExpr) innerString(eol EOL, lvl int) string {
	return "Array<" + formatInner(eol, lvl, l.Expr) + ">"
}

type ImportSpec struct {
	TypeOnly bool
	Imports  Idents
	// Only used for the namespace-form import, when Imports is empty
	AsName      string
	From        Str
	CommentList []Comment
}

func (i ImportSpec) Comments() []Comment {
	return i.CommentList
}
func (i ImportSpec) decl() {}
func (i ImportSpec) String() string {
	var b strings.Builder
	b.WriteString("import ")
	if i.TypeOnly {
		b.WriteString("type ")
	}
	switch len(i.Imports) {
	case 0:
		fmt.Fprintf(&b, "* as %s", i.AsName)
	case 1:
		fmt.Fprintf(&b, "{ %s }", i.Imports[0])
	default:
		strs := make([]string, 0, len(i.Imports))
		for _, elem := range i.Imports {
			strs = append(strs, elem.String())
		}
		fmt.Fprintf(&b, "{\n%s%s\n}", Indent, strings.Join(strs, ",\n"+Indent))
	}

	fmt.Fprintf(&b, " from %s%s", i.From, EOLSemicolon)
	return b.String()
}

type Comment struct {
	Text string // text of comment, excluding '\n' for //-style
	Pos  CommentPosition
}

func (c Comment) String() string {
	return c.Text
}

func (c Comment) innerString(eol EOL, lvl int) string {
	return strings.Replace(c.Text, "\n", "\n"+strings.Repeat(Indent, lvl), -1)
}

// CommentPosition indicates the position at which a comment should be printed,
// relative to its associated Node.
type CommentPosition int

const (
	// CommentAbove places a comment on a new line above the associated Node,
	// preserving indentation.
	CommentAbove CommentPosition = iota
	// CommentInline places a comment inline following the associated Node.
	CommentInline
	// CommentBelow places a comment after the associated Node, on a new line,
	// preserving indentation.
	CommentBelow
)

type Raw struct {
	Data string
}

func (r Raw) decl() {}
func (r Raw) expr() {}
func (r Raw) String() string {
	return r.Data
}
