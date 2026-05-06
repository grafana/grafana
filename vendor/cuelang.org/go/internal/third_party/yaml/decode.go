package yaml

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"math"
	"reflect"
	"strconv"
	"strings"
	"time"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
)

const (
	documentNode = 1 << iota
	mappingNode
	sequenceNode
	scalarNode
	aliasNode
)

type node struct {
	kind     int
	startPos yaml_mark_t
	endPos   yaml_mark_t
	tag      string
	// For an alias node, alias holds the resolved alias.
	alias    *node
	value    string
	implicit bool
	children []*node
	anchors  map[string]*node
}

// ----------------------------------------------------------------------------
// Parser, produces a node tree out of a libyaml event stream.

type parser struct {
	parser   yaml_parser_t
	event    yaml_event_t
	doc      *node
	info     *token.File
	last     *node
	doneInit bool
}

func readSource(filename string, src interface{}) ([]byte, error) {
	if src != nil {
		switch s := src.(type) {
		case string:
			return []byte(s), nil
		case []byte:
			return s, nil
		case *bytes.Buffer:
			// is io.Reader, but src is already available in []byte form
			if s != nil {
				return s.Bytes(), nil
			}
		case io.Reader:
			var buf bytes.Buffer
			if _, err := io.Copy(&buf, s); err != nil {
				return nil, err
			}
			return buf.Bytes(), nil
		}
		return nil, errors.New("invalid source")
	}
	return ioutil.ReadFile(filename)
}

func newParser(filename string, src interface{}) (*parser, error) {
	b, err := readSource(filename, src)
	if err != nil {
		return nil, err
	}
	info := token.NewFile(filename, -1, len(b)+2)
	info.SetLinesForContent(b)
	p := parser{info: info}
	if !yaml_parser_initialize(&p.parser, filename) {
		panic("failed to initialize YAML emitter")
	}
	if len(b) == 0 {
		b = []byte{'\n'}
	}
	yaml_parser_set_input_string(&p.parser, b)
	return &p, nil
}

func (p *parser) init() {
	if p.doneInit {
		return
	}
	p.expect(yaml_STREAM_START_EVENT)
	p.doneInit = true
}

func (p *parser) destroy() {
	if p.event.typ != yaml_NO_EVENT {
		yaml_event_delete(&p.event)
	}
	yaml_parser_delete(&p.parser)
}

// expect consumes an event from the event stream and
// checks that it's of the expected type.
func (p *parser) expect(e yaml_event_type_t) {
	if p.event.typ == yaml_NO_EVENT {
		if !yaml_parser_parse(&p.parser, &p.event) {
			p.fail()
		}
	}
	if p.event.typ == yaml_STREAM_END_EVENT {
		p.failf(p.event.end_mark.line, "attempted to go past the end of stream; corrupted value?")
	}
	if p.event.typ != e {
		p.parser.problem = fmt.Sprintf("expected %s event but got %s", e, p.event.typ)
		p.fail()
	}
	yaml_event_delete(&p.event)
	p.event.typ = yaml_NO_EVENT
}

// peek peeks at the next event in the event stream,
// puts the results into p.event and returns the event type.
func (p *parser) peek() yaml_event_type_t {
	if p.event.typ != yaml_NO_EVENT {
		return p.event.typ
	}
	if !yaml_parser_parse(&p.parser, &p.event) {
		p.fail()
	}
	return p.event.typ
}

func (p *parser) fail() {
	var line int
	if p.parser.problem_mark.line != 0 {
		line = p.parser.problem_mark.line
		// Scanner errors don't iterate line before returning error
		if p.parser.error != yaml_SCANNER_ERROR {
			line--
		}
	} else if p.parser.context_mark.line != 0 {
		line = p.parser.context_mark.line - 1
	}
	var msg string
	if len(p.parser.problem) > 0 {
		msg = p.parser.problem
	} else {
		msg = "unknown problem parsing YAML content"
	}
	p.failf(line, msg)
}

func (p *parser) anchor(n *node, anchor []byte) {
	if anchor != nil {
		p.doc.anchors[string(anchor)] = n
	}
}

func (p *parser) parse() *node {
	p.init()
	switch p.peek() {
	case yaml_SCALAR_EVENT:
		return p.scalar()
	case yaml_ALIAS_EVENT:
		return p.alias()
	case yaml_MAPPING_START_EVENT:
		return p.mapping()
	case yaml_SEQUENCE_START_EVENT:
		return p.sequence()
	case yaml_DOCUMENT_START_EVENT:
		return p.document()
	case yaml_STREAM_END_EVENT:
		// Happens when attempting to decode an empty buffer.
		return nil
	default:
		panic("attempted to parse unknown event: " + p.event.typ.String())
	}
}

func (p *parser) node(kind int) *node {
	n := &node{
		kind:     kind,
		startPos: p.event.start_mark,
		endPos:   p.event.end_mark,
	}
	return n
}

func (p *parser) document() *node {
	n := p.node(documentNode)
	n.anchors = make(map[string]*node)
	p.doc = n
	p.expect(yaml_DOCUMENT_START_EVENT)
	n.children = append(n.children, p.parse())
	p.expect(yaml_DOCUMENT_END_EVENT)
	return n
}

func (p *parser) alias() *node {
	n := p.node(aliasNode)
	n.value = string(p.event.anchor)
	n.alias = p.doc.anchors[n.value]
	if n.alias == nil {
		p.failf(n.startPos.line, "unknown anchor '%s' referenced", n.value)
	}
	p.expect(yaml_ALIAS_EVENT)
	return n
}

func (p *parser) scalar() *node {
	n := p.node(scalarNode)
	n.value = string(p.event.value)
	n.tag = string(p.event.tag)
	n.implicit = p.event.implicit
	p.anchor(n, p.event.anchor)
	p.expect(yaml_SCALAR_EVENT)
	return n
}

func (p *parser) sequence() *node {
	n := p.node(sequenceNode)
	p.anchor(n, p.event.anchor)
	p.expect(yaml_SEQUENCE_START_EVENT)
	for p.peek() != yaml_SEQUENCE_END_EVENT {
		n.children = append(n.children, p.parse())
	}
	if len(n.children) > 0 {
		n.endPos = n.children[len(n.children)-1].endPos
	}
	p.expect(yaml_SEQUENCE_END_EVENT)
	return n
}

func (p *parser) mapping() *node {
	n := p.node(mappingNode)
	p.anchor(n, p.event.anchor)
	p.expect(yaml_MAPPING_START_EVENT)
	for p.peek() != yaml_MAPPING_END_EVENT {
		n.children = append(n.children, p.parse(), p.parse())
	}
	if len(n.children) > 0 {
		n.endPos = n.children[len(n.children)-1].endPos
	}
	p.expect(yaml_MAPPING_END_EVENT)
	return n
}

// ----------------------------------------------------------------------------
// Decoder, unmarshals a node into a provided value.

type decoder struct {
	p            *parser
	doc          *node
	aliases      map[*node]bool
	terrors      []string
	prev         token.Pos
	lastNode     ast.Node
	forceNewline bool
}

var (
	durationType   = reflect.TypeOf(time.Duration(0))
	defaultMapType = reflect.TypeOf(map[interface{}]interface{}{})
	timeType       = reflect.TypeOf(time.Time{})
	ptrTimeType    = reflect.TypeOf(&time.Time{})
)

func newDecoder(p *parser) *decoder {
	d := &decoder{p: p}
	d.aliases = make(map[*node]bool)
	return d
}

func (d *decoder) terror(n *node, tag string) string {
	if n.tag != "" {
		tag = n.tag
	}
	value := n.value
	if tag != yaml_SEQ_TAG && tag != yaml_MAP_TAG {
		if len(value) > 10 {
			value = " `" + value[:7] + "...`"
		} else {
			value = " `" + value + "`"
		}
	}
	msg := fmt.Sprintf("line %d: cannot unmarshal %s%s", n.startPos.line+1, shortTag(tag), value)
	d.terrors = append(d.terrors, msg)
	return msg
}

func (d *decoder) unmarshal(n *node) (node ast.Expr) {
	switch n.kind {
	case documentNode:
		node = d.document(n)
	case aliasNode:
		node = d.alias(n)
	default:
		switch n.kind {
		case scalarNode:
			node = d.scalar(n)
		case mappingNode:
			node = d.mapping(n)
		case sequenceNode:
			node = d.sequence(n)
		default:
			panic("internal error: unknown node kind: " + strconv.Itoa(n.kind))
		}
	}
	return node
}

func (d *decoder) attachDocComments(m yaml_mark_t, pos int8, expr ast.Node) {
	comments := []*ast.Comment{}
	line := 0
	for len(d.p.parser.comments) > 0 {
		c := d.p.parser.comments[0]
		if c.mark.index >= m.index {
			break
		}
		comments = append(comments, &ast.Comment{
			Slash: d.pos(c.mark),
			Text:  "//" + c.text[1:],
		})
		d.p.parser.comments = d.p.parser.comments[1:]
		line = c.mark.line
	}
	if len(comments) > 0 {
		expr.AddComment(&ast.CommentGroup{
			Doc:      pos == 0 && line+1 == m.line,
			Position: pos,
			List:     comments,
		})
	}
}

func (d *decoder) attachLineComment(m yaml_mark_t, pos int8, expr ast.Node) {
	if len(d.p.parser.comments) == 0 {
		return
	}
	c := d.p.parser.comments[0]
	if c.mark.index == m.index {
		comment := &ast.Comment{
			Slash: d.pos(c.mark),
			Text:  "//" + c.text[1:],
		}
		expr.AddComment(&ast.CommentGroup{
			Line:     true,
			Position: pos,
			List:     []*ast.Comment{comment},
		})
	}
}

func (d *decoder) pos(m yaml_mark_t) token.Pos {
	pos := d.p.info.Pos(m.index+1, token.NoRelPos)

	if d.forceNewline {
		d.forceNewline = false
		pos = pos.WithRel(token.Newline)
	} else if d.prev.IsValid() {
		c := pos.Position()
		p := d.prev.Position()
		switch {
		case c.Line-p.Line >= 2:
			pos = pos.WithRel(token.NewSection)
		case c.Line-p.Line == 1:
			pos = pos.WithRel(token.Newline)
		case c.Column-p.Column > 0:
			pos = pos.WithRel(token.Blank)
		default:
			pos = pos.WithRel(token.NoSpace)
		}
		if pos.Before(d.prev) {
			return token.NoPos
		}
	}

	d.prev = pos
	return pos
}

func (d *decoder) absPos(m yaml_mark_t) token.Pos {
	return d.p.info.Pos(m.index+1, token.NoRelPos)
}

func (d *decoder) start(n *node) token.Pos {
	if n.startPos == n.endPos {
		return token.NoPos
	}
	return d.pos(n.startPos)
}

func (d *decoder) ident(n *node, name string) *ast.Ident {
	return &ast.Ident{
		NamePos: d.pos(n.startPos),
		Name:    name,
	}
}

func (d *decoder) document(n *node) ast.Expr {
	if len(n.children) == 1 {
		d.doc = n
		return d.unmarshal(n.children[0])
	}
	return &ast.BottomLit{} // TODO: more informatives
}

func (d *decoder) alias(n *node) ast.Expr {
	if d.aliases[n] {
		// TODO this could actually be allowed in some circumstances.
		d.p.failf(n.startPos.line, "anchor '%s' value contains itself", n.value)
	}
	d.aliases[n] = true
	node := d.unmarshal(n.alias)
	delete(d.aliases, n)
	return node
}

var zeroValue reflect.Value

func (d *decoder) scalar(n *node) ast.Expr {
	var tag string
	var resolved interface{}
	if n.tag == "" && !n.implicit {
		tag = yaml_STR_TAG
		resolved = n.value
	} else {
		tag, resolved = d.resolve(n)
		if tag == yaml_BINARY_TAG {
			data, err := base64.StdEncoding.DecodeString(resolved.(string))
			if err != nil {
				d.p.failf(n.startPos.line, "!!binary value contains invalid base64 data")
			}
			resolved = string(data)
		}
	}
	if resolved == nil {
		return &ast.BasicLit{
			ValuePos: d.start(n).WithRel(token.Blank),
			Kind:     token.NULL,
			Value:    "null",
		}
	}
	switch tag {
	// TODO: use parse literal or parse expression instead.
	case yaml_TIMESTAMP_TAG:
		return &ast.BasicLit{
			ValuePos: d.start(n),
			Kind:     token.STRING,
			Value:    literal.String.Quote(n.value),
		}

	case yaml_STR_TAG:
		return &ast.BasicLit{
			ValuePos: d.start(n),
			Kind:     token.STRING,
			Value:    quoteString(n.value),
		}

	case yaml_BINARY_TAG:
		return &ast.BasicLit{
			ValuePos: d.start(n),
			Kind:     token.STRING,
			Value:    literal.Bytes.Quote(resolved.(string)),
		}

	case yaml_BOOL_TAG:
		tok := token.FALSE
		str := "false"
		if b, _ := resolved.(bool); b {
			tok = token.TRUE
			str = "true"
		}
		return &ast.BasicLit{
			ValuePos: d.start(n),
			Kind:     tok,
			Value:    str,
		}

	case yaml_INT_TAG:
		// Convert YAML octal to CUE octal. If YAML accepted an invalid
		// integer, just convert it as well to ensure CUE will fail.
		s := n.value
		if len(s) > 1 && s[0] == '0' && s[1] <= '9' {
			s = "0o" + s[1:]
		}
		return d.makeNum(n, s, token.INT)

	case yaml_FLOAT_TAG:
		value := n.value
		if f, ok := resolved.(float64); ok {
			switch {
			case math.IsInf(f, -1),
				math.IsInf(f, 1),
				math.IsNaN(f):
				value = fmt.Sprint(f)
			}
		}
		if n.tag != "" {
			if p := strings.IndexAny(value, ".eEiInN"); p == -1 {
				// TODO: float(v) when we have conversions
				value = fmt.Sprintf("float & %s", value)
			}
		}
		return d.makeNum(n, value, token.FLOAT)

	case yaml_NULL_TAG:
		return &ast.BasicLit{
			ValuePos: d.start(n).WithRel(token.Blank),
			Kind:     token.NULL,
			Value:    "null",
		}
	}
	d.terror(n, tag)
	return &ast.BottomLit{}
}

func (d *decoder) label(n *node) ast.Label {
	pos := d.pos(n.startPos)

	switch x := d.scalar(n).(type) {
	case *ast.BasicLit:
		if x.Kind == token.STRING {
			if ast.IsValidIdent(n.value) && !internal.IsDefOrHidden(n.value) {
				return &ast.Ident{
					NamePos: pos,
					Name:    n.value,
				}
			}
			ast.SetPos(x, pos)
			return x
		}

		return &ast.BasicLit{
			ValuePos: pos,
			Kind:     token.STRING,
			Value:    literal.Label.Quote(x.Value),
		}

	default:
		d.p.failf(n.startPos.line, "invalid label: %q", n.value)
	}

	return &ast.BasicLit{
		ValuePos: pos,
		Kind:     token.STRING,
		Value:    "<invalid>",
	}
}

func (d *decoder) makeNum(n *node, val string, kind token.Token) (expr ast.Expr) {
	minuses := 0
	for ; val[0] == '-'; val = val[1:] {
		minuses++
	}
	expr = &ast.BasicLit{
		ValuePos: d.start(n), //  + minuses.Pos(),
		Kind:     kind,
		Value:    val,
	}
	if minuses > 0 {
		expr = &ast.UnaryExpr{
			OpPos: d.start(n),
			Op:    token.SUB,
			X:     expr,
		}
	}
	return expr
}

// quoteString converts a string to a CUE multiline string if needed.
func quoteString(s string) string {
	lines := []string{}
	last := 0
	for i, c := range s {
		if c == '\n' {
			lines = append(lines, s[last:i])
			last = i + 1
		}
		if c == '\r' {
			goto quoted
		}
	}
	lines = append(lines, s[last:])
	if len(lines) >= 2 {
		buf := []byte{}
		buf = append(buf, `"""`+"\n"...)
		for _, l := range lines {
			if l == "" {
				// no indentation for empty lines
				buf = append(buf, '\n')
				continue
			}
			buf = append(buf, '\t')
			p := len(buf)
			buf = strconv.AppendQuote(buf, l)
			// remove quotes
			buf[p] = '\t'
			buf[len(buf)-1] = '\n'
		}
		buf = append(buf, "\t\t"+`"""`...)
		return string(buf)
	}
quoted:
	return literal.String.Quote(s)
}

func (d *decoder) sequence(n *node) ast.Expr {
	list := &ast.ListLit{}
	list.Lbrack = d.pos(n.startPos).WithRel(token.Blank)
	switch ln := len(n.children); ln {
	case 0:
		d.prev = list.Lbrack
	default:
		d.prev = d.pos(n.children[ln-1].endPos)
	}
	list.Rbrack = d.pos(n.endPos)

	noNewline := true
	single := d.isOneLiner(n.startPos, n.endPos)
	for _, c := range n.children {
		d.forceNewline = !single
		elem := d.unmarshal(c)
		list.Elts = append(list.Elts, elem)
		_, noNewline = elem.(*ast.StructLit)
	}
	if !single && !noNewline {
		list.Rbrack = list.Rbrack.WithRel(token.Newline)
	}
	return list
}

func (d *decoder) isOneLiner(start, end yaml_mark_t) bool {
	s := d.absPos(start).Position()
	e := d.absPos(end).Position()
	return s.Line == e.Line
}

func (d *decoder) mapping(n *node) ast.Expr {
	newline := d.forceNewline

	structure := &ast.StructLit{}
	d.insertMap(n, structure, false)

	// NOTE: we currently translate YAML without curly braces to CUE with
	// curly braces, even for single elements. Removing the following line
	// would generate the folded form.
	structure.Lbrace = d.absPos(n.startPos).WithRel(token.NoSpace)
	structure.Rbrace = d.absPos(n.endPos).WithRel(token.Newline)
	if d.isOneLiner(n.startPos, n.endPos) && !newline {
		if len(structure.Elts) != 1 {
			structure.Lbrace = d.absPos(n.startPos).WithRel(token.Blank)
		}
		if len(structure.Elts) != 1 || structure.Elts[0].Pos().RelPos() < token.Newline {
			structure.Rbrace = structure.Rbrace.WithRel(token.Blank)
		}
	}
	return structure
}

func (d *decoder) insertMap(n *node, m *ast.StructLit, merge bool) {
	l := len(n.children)
outer:
	for i := 0; i < l; i += 2 {
		if isMerge(n.children[i]) {
			merge = true
			d.merge(n.children[i+1], m)
			continue
		}
		switch n.children[i].kind {
		case mappingNode:
			d.p.failf(n.startPos.line, "invalid map key: map")
		case sequenceNode:
			d.p.failf(n.startPos.line, "invalid map key: sequence")
		}

		field := &ast.Field{}
		d.attachDocComments(n.children[i].startPos, 0, field)

		label := d.label(n.children[i])
		field.Label = label
		d.attachLineComment(n.children[i].endPos, 1, label)

		if merge {
			key := labelStr(label)
			for _, decl := range m.Elts {
				f := decl.(*ast.Field)
				name, _, err := ast.LabelName(f.Label)
				if err == nil && name == key {
					f.Value = d.unmarshal(n.children[i+1])
					continue outer
				}
			}
		}

		value := d.unmarshal(n.children[i+1])
		field.Value = value
		d.attachDocComments(n.children[i+1].startPos, 0, value)
		d.attachLineComment(n.children[i+1].endPos, 10, value)

		m.Elts = append(m.Elts, field)
	}
}

func labelStr(l ast.Label) string {
	switch x := l.(type) {
	case *ast.Ident:
		return x.Name
	case *ast.BasicLit:
		s, _ := strconv.Unquote(x.Value)
		return s
	}
	return ""
}

func (d *decoder) failWantMap(n *node) {
	d.p.failf(n.startPos.line, "map merge requires map or sequence of maps as the value")
}

func (d *decoder) merge(n *node, m *ast.StructLit) {
	switch n.kind {
	case mappingNode:
		d.insertMap(n, m, true)
	case aliasNode:
		an, ok := d.doc.anchors[n.value]
		if ok && an.kind != mappingNode {
			d.failWantMap(n)
		}
		d.insertMap(an, m, true)
	case sequenceNode:
		// Step backwards as earlier nodes take precedence.
		for i := len(n.children) - 1; i >= 0; i-- {
			ni := n.children[i]
			if ni.kind == aliasNode {
				an, ok := d.doc.anchors[ni.value]
				if ok && an.kind != mappingNode {
					d.failWantMap(n)
				}
				d.insertMap(an, m, true)
				continue
			} else if ni.kind != mappingNode {
				d.failWantMap(n)
			}
			d.insertMap(ni, m, true)
		}
	default:
		d.failWantMap(n)
	}
}

func isMerge(n *node) bool {
	return n.kind == scalarNode && n.value == "<<" && (n.implicit == true || n.tag == yaml_MERGE_TAG)
}
