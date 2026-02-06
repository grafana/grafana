package ts

import (
	"bufio"
	"strings"

	"github.com/grafana/cuetsy/ts/ast"
	"github.com/kr/text"
)

// CommentFromString takes a string input and formats it as an ast.CommentList.
//
// Line breaks are automatically inserted to minimize raggedness, with a loose
// width limit the provided lim.
//
// If the jsdoc param is true, the resulting comment will be formatted with
// JSDoc ( /** ... */ )-style. Otherwise, ordinary comment leader ( // ... ) will
// be used.
//
// The returned ast.CommentList will have the default CommentAbove position.
func CommentFromString(s string, lim int, jsdoc bool) ast.Comment {
	var b strings.Builder
	prefix := func() { b.WriteString("// ") }
	if jsdoc {
		b.WriteString("/**\n")
		prefix = func() { b.WriteString(" * ") }
	}

	scanner := bufio.NewScanner(strings.NewReader(text.Wrap(s, lim)))
	var i int
	for scanner.Scan() {
		if i != 0 {
			b.WriteString("\n")
		}
		prefix()
		b.WriteString(scanner.Text())
		i++
	}
	if jsdoc {
		b.WriteString("\n */\n")
	}

	return ast.Comment{
		Text: b.String(),
	}
}

type Comment struct {
	Text      string
	Multiline bool
	JSDoc     bool
}

// CommentFromCUEGroup creates an ast.CommentList from a Comment.
//
// Original line breaks are preserved, in keeping with principles of semantic line breaks.
func CommentFromCUEGroup(cg Comment) ast.Comment {
	var b strings.Builder
	pos := ast.CommentAbove
	if !cg.Multiline {
		pos = ast.CommentInline
	}

	prefix := func() { b.WriteString("// ") }
	if cg.JSDoc && cg.Multiline {
		b.WriteString("/**\n")
		prefix = func() { b.WriteString(" * ") }
	} else {
		b.WriteString("//")
		prefix = func() { b.WriteString(" ") }
	}

	scanner := bufio.NewScanner(strings.NewReader(cg.Text))
	var i int
	for scanner.Scan() {
		if i != 0 {
			b.WriteString("\n")
		}
		prefix()
		b.WriteString(scanner.Text())
		i++
	}
	if cg.JSDoc && cg.Multiline {
		b.WriteString("\n")
		b.WriteString(" */")
	}

	return ast.Comment{
		Text: b.String(),
		Pos:  pos,
	}
}
