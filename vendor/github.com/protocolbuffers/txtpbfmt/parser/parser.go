// Package parser edits text proto files, applies standard formatting
// and preserves comments.
// See also: https://github.com/golang/protobuf/blob/master/proto/text_parser.go
//
// To disable a specific file from getting formatted, add '# txtpbfmt: disable'
// at the top of the file.
package parser

import (
	"bufio"
	"bytes"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	log "github.com/golang/glog"
	"github.com/mitchellh/go-wordwrap"
	"github.com/protocolbuffers/txtpbfmt/ast"
	"github.com/protocolbuffers/txtpbfmt/unquote"
)

// Config can be used to pass additional config parameters to the formatter at
// the time of the API call.
type Config struct {
	// Do not apply any reformatting to this file.
	Disable bool

	// Expand all children irrespective of the initial state.
	ExpandAllChildren bool

	// Skip colons whenever possible.
	SkipAllColons bool

	// Allow unnamed nodes everywhere.
	// Default is to allow only top-level nodes to be unnamed.
	AllowUnnamedNodesEverywhere bool

	// Sort fields by field name.
	SortFieldsByFieldName bool

	// Sort adjacent scalar fields of the same field name by their contents.
	SortRepeatedFieldsByContent bool

	// Sort adjacent message fields of the given field name by the contents of the given subfield.
	// Format: either "field_name.subfield_name" or just "subfield_name" (applies to all field names).
	SortRepeatedFieldsBySubfield []string

	// Map from Node.Name to the order of all fields within that node. See AddFieldSortOrder().
	fieldSortOrder map[string][]string

	// RequireFieldSortOrderToMatchAllFieldsInNode will cause parsing to fail if a node was added via
	// AddFieldSortOrder() but 1+ fields under that node in the textproto aren't specified in the
	// field order. This won't fail for nodes that don't have a field order specified at all. Use this
	// to strictly enforce that your field order config always orders ALL the fields, and you're
	// willing for new fields in the textproto to break parsing in order to enforce it.
	RequireFieldSortOrderToMatchAllFieldsInNode bool

	// Remove lines that have the same field name and scalar value as another.
	RemoveDuplicateValuesForRepeatedFields bool

	// Permit usage of Python-style """ or ''' delimited strings.
	AllowTripleQuotedStrings bool

	// Max columns for string field values. If zero, no string wrapping will occur.
	// Strings that may contain HTML tags will never be wrapped.
	WrapStringsAtColumn int

	// Whether strings that appear to contain HTML tags should be wrapped
	// (requires WrapStringsAtColumn to be set).
	WrapHTMLStrings bool

	// Whether angle brackets used instead of curly braces should be preserved
	// when outputting a formatted textproto.
	PreserveAngleBrackets bool

	// Use single quotes around strings that contain double but not single quotes.
	SmartQuotes bool
}

// RootName contains a constant that can be used to identify the root of all Nodes.
const RootName = "__ROOT__"

// AddFieldSortOrder adds a config rule for the given Node.Name, so that all contained field names
// are output in the provided order. To specify an order for top-level Nodes, use RootName as the
// nodeName.
func (c *Config) AddFieldSortOrder(nodeName string, fieldOrder ...string) {
	if c.fieldSortOrder == nil {
		c.fieldSortOrder = make(map[string][]string)
	}
	c.fieldSortOrder[nodeName] = fieldOrder
}

// UnsortedFieldsError will be returned by ParseWithConfig if
// Config.RequireFieldSortOrderToMatchAllFieldsInNode is set, and an unrecognized field is found
// while parsing.
type UnsortedFieldsError struct {
	UnsortedFields []UnsortedField
}

// UnsortedField records details about a single unsorted field.
type UnsortedField struct {
	FieldName       string
	Line            int32
	ParentFieldName string
}

func (e *UnsortedFieldsError) Error() string {
	var errs []string
	for _, us := range e.UnsortedFields {
		errs = append(errs, fmt.Sprintf("  line: %d, parent field: %q, unsorted field: %q", us.Line, us.ParentFieldName, us.FieldName))
	}
	return fmt.Sprintf("fields parsed that were not specified in the parser.AddFieldSortOrder() call:\n%s", strings.Join(errs, "\n"))
}

type parser struct {
	in     []byte
	index  int
	length int
	log    log.Verbose
	// Maps the index of '{' characters on 'in' that have the matching '}' on
	// the same line to 'true'.
	bracketSameLine map[int]bool
	config          Config
	line, column    int // current position, 1-based.
}

var defConfig = Config{}
var tagRegex = regexp.MustCompile(`<.*>`)

const indentSpaces = "  "

func getMetaComments(in []byte) map[string]bool {
	metaComments := map[string]bool{}
	scanner := bufio.NewScanner(bytes.NewReader(in))
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) == 0 {
			continue
		}
		if line[0] != byte('#') {
			break // only process the leading comment block
		}
		colon := strings.IndexByte(line, byte(':'))
		if colon > 1 && strings.TrimSpace(line[1:colon]) == "txtpbfmt" {
			for _, s := range strings.Split(line[colon+1:], ",") {
				metaComments[strings.TrimSpace(s)] = true
			}
		}
	}
	return metaComments
}

// Format formats a text proto file preserving comments.
func Format(in []byte) ([]byte, error) {
	return FormatWithConfig(in, defConfig)
}

// FormatWithConfig functions similar to format, but allows the user to pass in
// additional configuration options.
func FormatWithConfig(in []byte, c Config) ([]byte, error) {
	addMetaCommentsToConfig(in, &c)
	if c.Disable {
		log.Infoln("Ignored file with 'disable' comment.")
		return in, nil
	}
	nodes, err := parseWithMetaCommentConfig(in, c)
	if err != nil {
		return nil, err
	}
	return out(nodes), nil
}

// Return the byte-positions of each bracket which has the corresponding close on the
// same line as a set.
func sameLineBrackets(in []byte, allowTripleQuotedStrings bool) (map[int]bool, error) {
	line := 1
	type bracket struct {
		index int
		line  int
	}
	open := []bracket{} // Stack.
	res := map[int]bool{}
	insideComment := false
	insideString := false
	insideTemplate := false
	insideTripleQuotedString := false
	var stringDelimiter string
	isEscapedChar := false
	for i, c := range in {
		switch c {
		case '\n':
			line++
			insideComment = false
		case '{', '<':
			if insideComment || insideString || insideTemplate {
				continue
			}
			open = append(open, bracket{index: i, line: line})
		case '}', '>':
			if insideComment || insideString || insideTemplate {
				continue
			}
			if len(open) == 0 {
				return nil, fmt.Errorf("too many '}' or '>' at index %d", i)
			}
			last := len(open) - 1
			br := open[last]
			open = open[:last]
			if br.line == line {
				res[br.index] = true
			}
		case '#':
			if insideString {
				continue
			}
			insideComment = true
		case '%':
			if insideComment || insideString {
				continue
			}
			if insideTemplate {
				insideTemplate = false
			} else {
				insideTemplate = true
			}
		case '"', '\'':
			if insideComment {
				continue
			}
			delim := string(c)
			tripleQuoted := false
			if allowTripleQuotedStrings && i+3 <= len(in) {
				triple := string(in[i : i+3])
				if triple == `"""` || triple == `'''` {
					delim = triple
					tripleQuoted = true
				}
			}

			if insideString {
				if stringDelimiter == delim && (insideTripleQuotedString || !isEscapedChar) {
					insideString = false
					insideTripleQuotedString = false
				}
			} else {
				insideString = true
				if tripleQuoted {
					insideTripleQuotedString = true
				}
				stringDelimiter = delim
			}
		}

		if isEscapedChar {
			isEscapedChar = false
		} else if c == '\\' && insideString && !insideTripleQuotedString {
			isEscapedChar = true
		}
	}
	if insideString {
		return nil, fmt.Errorf("unterminated string literal")
	}
	return res, nil
}

func removeDeleted(nodes []*ast.Node) []*ast.Node {
	res := []*ast.Node{}
	// When removing a node which has an empty line before it, we should keep
	// the empty line before the next non-removed node to maintain the visual separation.
	// Consider the following:
	// foo: { name: "foo1" }
	// foo: { name: "foo2" }
	//
	// bar: { name: "bar1" }
	// bar: { name: "bar2" }
	//
	// If we decide to remove both foo2 and bar1, the result should still have one empty
	// line between foo1 and bar2.
	addEmptyLine := false
	for _, node := range nodes {
		if node.Deleted {
			if len(node.PreComments) > 0 && node.PreComments[0] == "" {
				addEmptyLine = true
			}
			continue
		}
		if len(node.Children) > 0 {
			node.Children = removeDeleted(node.Children)
		}
		if addEmptyLine && (len(node.PreComments) == 0 || node.PreComments[0] != "") {
			node.PreComments = append([]string{""}, node.PreComments...)
		}
		addEmptyLine = false
		res = append(res, node)
	}
	return res
}

var (
	spaceSeparators = []byte(" \t\n")
	valueSeparators = []byte(" \t\n{}:,[]<>;#")
)

// Parse returns a tree representation of a textproto file.
func Parse(in []byte) ([]*ast.Node, error) {
	return ParseWithConfig(in, defConfig)
}

// ParseWithConfig functions similar to Parse, but allows the user to pass in
// additional configuration options.
func ParseWithConfig(in []byte, c Config) ([]*ast.Node, error) {
	addMetaCommentsToConfig(in, &c)
	return parseWithMetaCommentConfig(in, c)
}

// Parses in textproto with MetaComments already added to configuration.
func parseWithMetaCommentConfig(in []byte, c Config) ([]*ast.Node, error) {
	p, err := newParser(in, c)
	if err != nil {
		return nil, err
	}
	if p.log {
		p.log.Infof("p.in: %q", string(p.in))
		p.log.Infof("p.length: %v", p.length)
	}
	// Although unnamed nodes aren't strictly allowed, some formats represent a
	// list of protos as a list of unnamed top-level nodes.
	nodes, _, err := p.parse( /*isRoot=*/ true)
	if err != nil {
		return nil, err
	}
	if p.index < p.length {
		return nil, fmt.Errorf("parser didn't consume all input. Stopped at %s", p.errorContext())
	}
	wrapStrings(nodes, 0, c)
	err = sortAndFilterNodes( /*parent=*/ nil, nodes, nodeSortFunction(c), nodeFilterFunction(c))
	if err != nil {
		return nil, err
	}
	return nodes, nil
}

func addMetaCommentsToConfig(in []byte, c *Config) {
	metaComments := getMetaComments(in)
	if metaComments["allow_triple_quoted_strings"] {
		c.AllowTripleQuotedStrings = true
	}
	if metaComments["allow_unnamed_nodes_everywhere"] {
		c.AllowUnnamedNodesEverywhere = true
	}
	if metaComments["disable"] {
		c.Disable = true
	}
	if metaComments["expand_all_children"] {
		c.ExpandAllChildren = true
	}
	if metaComments["preserve_angle_brackets"] {
		c.PreserveAngleBrackets = true
	}
	if metaComments["remove_duplicate_values_for_repeated_fields"] {
		c.RemoveDuplicateValuesForRepeatedFields = true
	}
	if metaComments["skip_all_colons"] {
		c.SkipAllColons = true
	}
	if metaComments["smartquotes"] {
		c.SmartQuotes = true
	}
	if metaComments["sort_fields_by_field_name"] {
		c.SortFieldsByFieldName = true
	}
	if metaComments["sort_repeated_fields_by_content"] {
		c.SortRepeatedFieldsByContent = true
	}
	for _, sf := range getMetaCommentStringValues("sort_repeated_fields_by_subfield", metaComments) {
		c.SortRepeatedFieldsBySubfield = append(c.SortRepeatedFieldsBySubfield, sf)
	}
	if metaComments["wrap_html_strings"] {
		c.WrapHTMLStrings = true
	}
	setMetaCommentIntValue("wrap_strings_at_column", metaComments, &c.WrapStringsAtColumn)
}

// For a MetaComment in the form comment_name=<int> set *int to the value. Will not change
// the *int if the comment name isn't present.
func setMetaCommentIntValue(name string, metaComments map[string]bool, value *int) {
	for mc := range metaComments {
		if strings.HasPrefix(mc, fmt.Sprintf("%s ", name)) {
			log.Errorf("format should be %s=<int>, got: %s", name, mc)
			return
		}
		prefix := fmt.Sprintf("%s=", name)
		if strings.HasPrefix(mc, prefix) {
			intStr := strings.TrimPrefix(mc, prefix)
			var err error
			i, err := strconv.Atoi(strings.TrimSpace(intStr))
			if err != nil {
				log.Errorf("error parsing %s value %q (skipping): %v", name, intStr, err)
				return
			}
			*value = i
		}
	}
}

// For a MetaComment in the form comment_name=<string> returns the strings.
func getMetaCommentStringValues(name string, metaComments map[string]bool) []string {
	var vs []string
	for mc := range metaComments {
		if strings.HasPrefix(mc, fmt.Sprintf("%s ", name)) {
			log.Errorf("format should be %s=<string>, got: %s", name, mc)
			continue
		}
		prefix := fmt.Sprintf("%s=", name)
		if strings.HasPrefix(mc, prefix) {
			vs = append(vs, strings.TrimSpace(strings.TrimPrefix(mc, prefix)))
		}
	}
	return vs
}

func newParser(in []byte, c Config) (*parser, error) {
	var bracketSameLine map[int]bool
	if c.ExpandAllChildren {
		bracketSameLine = map[int]bool{}
	} else {
		var err error
		if bracketSameLine, err = sameLineBrackets(in, c.AllowTripleQuotedStrings); err != nil {
			return nil, err
		}
	}
	if len(in) > 0 && in[len(in)-1] != '\n' {
		in = append(in, '\n')
	}
	parser := &parser{
		in:              in,
		index:           0,
		length:          len(in),
		log:             log.V(2),
		bracketSameLine: bracketSameLine,
		config:          c,
		line:            1,
		column:          1,
	}
	return parser, nil
}

func (p *parser) nextInputIs(b byte) bool {
	return p.index < p.length && p.in[p.index] == b
}

func (p *parser) consume(b byte) bool {
	if !p.nextInputIs(b) {
		return false
	}
	p.index++
	p.column++
	if b == '\n' {
		p.line++
		p.column = 1
	}
	return true
}

// consumeString consumes the given string s, which should not have any newlines.
func (p *parser) consumeString(s string) bool {
	if p.index+len(s) > p.length {
		return false
	}
	if string(p.in[p.index:p.index+len(s)]) != s {
		return false
	}
	p.index += len(s)
	p.column += len(s)
	return true
}

// loopDetector detects if the parser is in an infinite loop (ie failing to
// make progress).
type loopDetector struct {
	lastIndex int
	count     int
	parser    *parser
}

func (p *parser) getLoopDetector() *loopDetector {
	return &loopDetector{lastIndex: p.index, parser: p}
}

func (l *loopDetector) iter() error {
	if l.parser.index == l.lastIndex {
		l.count++
		if l.count < 2 {
			return nil
		}
		return fmt.Errorf("parser failed to make progress at %s", l.parser.errorContext())
	}
	l.lastIndex = l.parser.index
	l.count = 0
	return nil
}

func (p parser) errorContext() string {
	index := p.index
	if index >= p.length {
		index = p.length - 1
	}
	// Provide the surrounding input as context.
	lastContentIndex := index + 20
	if lastContentIndex >= p.length {
		lastContentIndex = p.length - 1
	}
	previousContentIndex := index - 20
	if previousContentIndex < 0 {
		previousContentIndex = 0
	}
	before := string(p.in[previousContentIndex:index])
	after := string(p.in[index:lastContentIndex])
	return fmt.Sprintf("index %v\nposition %+v\nbefore: %q\nafter: %q\nbefore+after: %q", index, p.position(), before, after, before+after)
}

func (p *parser) position() ast.Position {
	return ast.Position{
		Byte:   uint32(p.index),
		Line:   int32(p.line),
		Column: int32(p.column),
	}
}

func (p *parser) consumeOptionalSeparator() error {
	if p.index > 0 && !p.isBlankSep(p.index-1) {
		// If an unnamed field immediately follows non-whitespace, we require a separator character first (key_one:,:value_two instead of key_one::value_two)
		if p.consume(':') {
			return fmt.Errorf("parser encountered unexpected : character (should be whitespace, or a ,; separator)")
		}
	}

	_ = p.consume(';') // Ignore optional ';'.
	_ = p.consume(',') // Ignore optional ','.

	return nil
}

// parse parses a text proto.
// It assumes the text to be either conformant with the standard text proto
// (i.e. passes proto.UnmarshalText() without error) or the alternative textproto
// format (sequence of messages, each of which passes proto.UnmarshalText()).
// endPos is the position of the first character on the first line
// after parsed nodes: that's the position to append more children.
func (p *parser) parse(isRoot bool) (result []*ast.Node, endPos ast.Position, err error) {
	res := []*ast.Node{}
	for ld := p.getLoopDetector(); p.index < p.length; {
		if err := ld.iter(); err != nil {
			return nil, ast.Position{}, err
		}

		startPos := p.position()
		if p.nextInputIs('\n') {
			// p.parse is often invoked with the index pointing at the
			// newline character after the previous item.
			// We should still report that this item starts in the next line.
			startPos.Byte++
			startPos.Line++
			startPos.Column = 1
		}

		// Read PreComments.
		comments, blankLines := p.skipWhiteSpaceAndReadComments(true /* multiLine */)

		// Handle blank lines.
		if blankLines > 1 {
			if p.log {
				p.log.Infof("blankLines: %v", blankLines)
			}
			comments = append([]string{""}, comments...)
		}

		for p.nextInputIs('%') {
			comments = append(comments, p.readTemplate())
			c, _ := p.skipWhiteSpaceAndReadComments(false)
			comments = append(comments, c...)
		}

		if endPos := p.position(); p.consume('}') || p.consume('>') || p.consume(']') {
			// Handle comments after last child.

			if len(comments) > 0 {
				res = append(res, &ast.Node{Start: startPos, PreComments: comments})
			}

			// endPos points at the closing brace, but we should rather return the position
			// of the first character after the previous item. Therefore let's rewind a bit:
			for endPos.Byte > 0 && p.in[endPos.Byte-1] == ' ' {
				endPos.Byte--
				endPos.Column--
			}

			if err = p.consumeOptionalSeparator(); err != nil {
				return nil, ast.Position{}, err
			}

			// Done parsing children.
			return res, endPos, nil
		}

		nd := &ast.Node{
			Start:       startPos,
			PreComments: comments,
		}
		if p.log {
			p.log.Infof("PreComments: %q", strings.Join(nd.PreComments, "\n"))
		}

		// Skip white-space other than '\n', which is handled below.
		for p.consume(' ') || p.consume('\t') {
		}

		// Handle multiple comment blocks.
		// <example>
		// # comment block 1
		// # comment block 1
		//
		// # comment block 2
		// # comment block 2
		// </example>
		// Each block that ends on an empty line (instead of a field) gets its own
		// 'empty' node.
		if p.nextInputIs('\n') {
			res = append(res, nd)
			continue
		}

		// Handle end of file.
		if p.index >= p.length {
			nd.End = p.position()
			if len(nd.PreComments) > 0 {
				res = append(res, nd)
			}
			break
		}

		if p.consume('[') {
			// Read Name (of proto extension).
			nd.Name = fmt.Sprintf("[%s]", p.readExtension())
			_ = p.consume(']') // Ignore the ']'.
		} else {
			// Read Name.
			nd.Name = p.readFieldName()
			if nd.Name == "" && !isRoot && !p.config.AllowUnnamedNodesEverywhere {
				return nil, ast.Position{}, fmt.Errorf("Failed to find a FieldName at %s", p.errorContext())
			}
		}
		if p.log {
			p.log.Infof("name: %q", nd.Name)
		}
		// Skip separator.
		_, _ = p.skipWhiteSpaceAndReadComments(true /* multiLine */)
		nd.SkipColon = !p.consume(':')
		previousPos := p.position()
		_, _ = p.skipWhiteSpaceAndReadComments(true /* multiLine */)

		if p.consume('{') || p.consume('<') {
			if p.config.SkipAllColons {
				nd.SkipColon = true
			}
			nd.ChildrenSameLine = p.bracketSameLine[p.index-1]
			nd.IsAngleBracket = p.config.PreserveAngleBrackets && p.in[p.index-1] == '<'
			// Recursive call to parse child nodes.
			nodes, lastPos, err := p.parse( /*isRoot=*/ false)
			if err != nil {
				return nil, ast.Position{}, err
			}
			nd.Children = nodes
			nd.End = lastPos

			nd.ClosingBraceComment = p.readInlineComment()
		} else if p.consume('[') {
			openBracketLine := p.line

			// Skip separator.
			preComments := p.readContinuousBlocksOfComments()

			if p.nextInputIs('{') {
				// Handle list of nodes.
				nd.ChildrenAsList = true

				nodes, lastPos, err := p.parse( /*isRoot=*/ true)
				if err != nil {
					return nil, ast.Position{}, err
				}
				if len(nodes) > 0 {
					nodes[0].PreComments = preComments
				}

				nd.Children = nodes
				nd.End = lastPos
				nd.ClosingBraceComment = p.readInlineComment()
				nd.ChildrenSameLine = openBracketLine == p.line
			} else {
				// Handle list of values.
				nd.ValuesAsList = true // We found values in list - keep it as list.

				for ld := p.getLoopDetector(); !p.consume(']') && p.index < p.length; {
					if err := ld.iter(); err != nil {
						return nil, ast.Position{}, err
					}

					// Read each value in the list.
					vals, err := p.readValues()
					if err != nil {
						return nil, ast.Position{}, err
					}
					if len(vals) != 1 {
						return nil, ast.Position{}, fmt.Errorf("multiple-string value not supported (%v). Please add comma explcitily, see http://b/162070952", vals)
					}
					vals[0].PreComments = append(vals[0].PreComments, preComments...)

					// Skip separator.
					_, _ = p.skipWhiteSpaceAndReadComments(false /* multiLine */)
					if p.consume(',') {
						vals[0].InlineComment = p.readInlineComment()
					}

					nd.Values = append(nd.Values, vals...)

					preComments, _ = p.skipWhiteSpaceAndReadComments(true /* multiLine */)
				}
				nd.ChildrenSameLine = openBracketLine == p.line

				res = append(res, nd)

				// Handle comments after last line (or for empty list)
				nd.PostValuesComments = preComments
				nd.ClosingBraceComment = p.readInlineComment()

				if err = p.consumeOptionalSeparator(); err != nil {
					return nil, ast.Position{}, err
				}

				continue
			}
		} else {
			// Rewind comments.
			p.index = int(previousPos.Byte)
			p.line = int(previousPos.Line)
			p.column = int(previousPos.Column)
			// Handle Values.
			nd.Values, err = p.readValues()
			if err != nil {
				return nil, ast.Position{}, err
			}
			if err = p.consumeOptionalSeparator(); err != nil {
				return nil, ast.Position{}, err
			}
		}
		if p.log && p.index < p.length {
			p.log.Infof("p.in[p.index]: %q", string(p.in[p.index]))
		}
		res = append(res, nd)
	}
	return res, p.position(), nil
}

func (p *parser) readFieldName() string {
	i := p.index
	for ; i < p.length && !p.isValueSep(i); i++ {
	}
	return p.advance(i)
}

func (p *parser) readExtension() string {
	i := p.index
	for ; i < p.length && (p.isBlankSep(i) || !p.isValueSep(i)); i++ {
	}
	return removeBlanks(p.advance(i))
}

func removeBlanks(in string) string {
	s := []byte(in)
	for _, b := range spaceSeparators {
		s = bytes.Replace(s, []byte{b}, nil, -1)
	}
	return string(s)
}

func (p *parser) readContinuousBlocksOfComments() []string {
	var preComments []string
	for {
		comments, blankLines := p.skipWhiteSpaceAndReadComments(true)
		if len(comments) == 0 {
			break
		}
		if blankLines > 0 && len(preComments) > 0 {
			comments = append([]string{""}, comments...)
		}
		preComments = append(preComments, comments...)
	}

	return preComments
}

// skipWhiteSpaceAndReadComments has multiple cases:
// - (1) reading a block of comments followed by a blank line
// - (2) reading a block of comments followed by non-blank content
// - (3) reading the inline comments between the current char and the end of the
//     current line
// Lines of comments and number of blank lines will be returned.
func (p *parser) skipWhiteSpaceAndReadComments(multiLine bool) ([]string, int) {
	i := p.index
	var foundComment, insideComment bool
	commentBegin := 0
	var comments []string
	blankLines := 0
	for ; i < p.length; i++ {
		if p.in[i] == '#' && !insideComment {
			insideComment = true
			foundComment = true
			commentBegin = i
		} else if p.in[i] == '\n' {
			if insideComment {
				comments = append(comments, string(p.in[commentBegin:i])) // Exclude the '\n'.
				insideComment = false
			} else if foundComment {
				i-- // Put back the last '\n' so the caller can detect that we're on case (1).
				break
			} else {
				blankLines++
			}
			if !multiLine {
				break
			}
		}
		if !insideComment && !p.isBlankSep(i) {
			break
		}
	}
	sep := p.advance(i)
	if p.log {
		p.log.Infof("sep: %q\np.index: %v", string(sep), p.index)
		if p.index < p.length {
			p.log.Infof("p.in[p.index]: %q", string(p.in[p.index]))
		}
	}
	return comments, blankLines
}

func (p *parser) isBlankSep(i int) bool {
	return bytes.Contains(spaceSeparators, p.in[i:i+1])
}

func (p *parser) isValueSep(i int) bool {
	return bytes.Contains(valueSeparators, p.in[i:i+1])
}

func (p *parser) advance(i int) string {
	if i > p.length {
		i = p.length
	}
	res := p.in[p.index:i]
	p.index = i
	strRes := string(res)
	newlines := strings.Count(strRes, "\n")
	if newlines == 0 {
		p.column += len(strRes)
	} else {
		p.column = len(strRes) - strings.LastIndex(strRes, "\n")
		p.line += newlines
	}
	return string(res)
}

func (p *parser) readValues() ([]*ast.Value, error) {
	var values []*ast.Value
	var previousPos ast.Position
	preComments, _ := p.skipWhiteSpaceAndReadComments(true /* multiLine */)
	if p.nextInputIs('%') {
		values = append(values, p.populateValue(p.readTemplate(), nil))
		previousPos = p.position()
	}
	if p.config.AllowTripleQuotedStrings {
		v, err := p.readTripleQuotedString()
		if err != nil {
			return nil, err
		}
		if v != nil {
			values = append(values, v)
			previousPos = p.position()
		}
	}
	for p.consume('"') || p.consume('\'') {
		// Handle string value.
		stringBegin := p.index - 1 // Index of the quote.
		i := p.index
		for ; i < p.length; i++ {
			if p.in[i] == '\\' {
				i++ // Skip escaped char.
				continue
			}
			if p.in[i] == '\n' {
				p.index = i
				return nil, fmt.Errorf("found literal (unescaped) new line in string at %s", p.errorContext())
			}
			if p.in[i] == p.in[stringBegin] {
				var vl string
				if p.config.SmartQuotes {
					vl = smartQuotes(p.advance(i))
				} else {
					vl = fixQuotes(p.advance(i))
				}
				_ = p.advance(i + 1) // Skip the quote.
				values = append(values, p.populateValue(vl, preComments))

				previousPos = p.position()
				preComments, _ = p.skipWhiteSpaceAndReadComments(true /* multiLine */)
				break
			}
		}
		if i == p.length {
			p.index = i
			return nil, fmt.Errorf("unfinished string at %s", p.errorContext())
		}
	}
	if previousPos != (ast.Position{}) {
		// Rewind comments.
		p.index = int(previousPos.Byte)
		p.line = int(previousPos.Line)
		p.column = int(previousPos.Column)
	} else {
		i := p.index
		// Handle other values.
		for ; i < p.length; i++ {
			if p.isValueSep(i) {
				break
			}
		}
		vl := p.advance(i)
		values = append(values, p.populateValue(vl, nil))
	}
	if p.log {
		p.log.Infof("values: %v", values)
	}
	return values, nil
}

func (p *parser) readTripleQuotedString() (*ast.Value, error) {
	start := p.index
	stringBegin := p.index
	delimiter := `"""`
	if !p.consumeString(delimiter) {
		delimiter = `'''`
		if !p.consumeString(delimiter) {
			return nil, nil
		}
	}

	for {
		if p.consumeString(delimiter) {
			break
		}
		if p.index == p.length {
			p.index = start
			return nil, fmt.Errorf("unfinished string at %s", p.errorContext())
		}
		p.index++
	}

	v := p.populateValue(string(p.in[stringBegin:p.index]), nil)

	return v, nil
}

func (p *parser) populateValue(vl string, preComments []string) *ast.Value {
	if p.log {
		p.log.Infof("value: %q", vl)
	}
	return &ast.Value{
		Value:         vl,
		InlineComment: p.readInlineComment(),
		PreComments:   preComments,
	}
}

func (p *parser) readInlineComment() string {
	inlineComment, _ := p.skipWhiteSpaceAndReadComments(false /* multiLine */)
	if p.log {
		p.log.Infof("inlineComment: %q", strings.Join(inlineComment, "\n"))
	}
	if len(inlineComment) > 0 {
		return inlineComment[0]
	}
	return ""
}

func (p *parser) readTemplate() string {
	if !p.nextInputIs('%') {
		return ""
	}
	i := p.index + 1
	for ; i < p.length; i++ {
		if p.in[i] == '"' || p.in[i] == '\'' {
			stringBegin := i // Index of quote.
			i++
			for ; i < p.length; i++ {
				if p.in[i] == '\\' {
					i++ // Skip escaped char.
					continue
				}
				if p.in[i] == p.in[stringBegin] {
					i++ // Skip end quote.
					break
				}
			}
		}
		if i < p.length && p.in[i] == '%' {
			i++
			break
		}
	}
	return p.advance(i)
}

// NodeSortFunction sorts the given nodes, using the parent node as context. parent can be nil.
type NodeSortFunction func(parent *ast.Node, nodes []*ast.Node) error

// NodeFilterFunction filters the given nodes.
type NodeFilterFunction func(nodes []*ast.Node)

func sortAndFilterNodes(parent *ast.Node, nodes []*ast.Node, sortFunction NodeSortFunction, filterFunction NodeFilterFunction) error {
	if len(nodes) == 0 {
		return nil
	}
	if filterFunction != nil {
		filterFunction(nodes)
	}
	for _, nd := range nodes {
		err := sortAndFilterNodes(nd, nd.Children, sortFunction, filterFunction)
		if err != nil {
			return err
		}
	}
	if sortFunction != nil {
		return sortFunction(parent, nodes)
	}
	return nil
}

// RemoveDuplicates marks duplicate key:value pairs from nodes as Deleted.
func RemoveDuplicates(nodes []*ast.Node) {
	type nameAndValue struct {
		name, value string
	}
	seen := make(map[nameAndValue]bool)
	for _, nd := range nodes {
		if seen != nil && len(nd.Values) == 1 {
			key := nameAndValue{nd.Name, nd.Values[0].Value}
			if _, value := seen[key]; value {
				// Name-Value pair found in the same nesting level, deleting.
				nd.Deleted = true
			} else {
				seen[key] = true
			}
		}
	}
}

func wrapStrings(nodes []*ast.Node, depth int, c Config) {
	if c.WrapStringsAtColumn == 0 {
		return
	}
	for _, nd := range nodes {
		if nd.ChildrenSameLine {
			return
		}
		if needsWrapping(nd, depth, c) {
			wrapLines(nd, depth, c)
		}
		wrapStrings(nd.Children, depth+1, c)
	}
}

func needsWrapping(nd *ast.Node, depth int, c Config) bool {
	// Even at depth 0 we have a 2-space indent when the wrapped string is rendered on the line below
	// the field name.
	const lengthBuffer = 2
	maxLength := c.WrapStringsAtColumn - lengthBuffer - (depth * len(indentSpaces))

	if !c.WrapHTMLStrings {
		for _, v := range nd.Values {
			if tagRegex.Match([]byte(v.Value)) {
				return false
			}
		}
	}

	for _, v := range nd.Values {
		if len(v.Value) >= 3 && (strings.HasPrefix(v.Value, `'''`) || strings.HasPrefix(v.Value, `"""`)) {
			// Don't wrap triple-quoted strings
			return false
		}
		if len(v.Value) > 0 && v.Value[0] != '\'' && v.Value[0] != '"' {
			// Only wrap strings
			return false
		}
		if len(v.Value) > maxLength {
			return true
		}
	}
	return false
}

// If the Values of this Node constitute a string, and if Config.WrapStringsAtColumn > 0, then wrap
// the string so each line is within the specified columns. Wraps only the current Node (does not
// recurse into Children).
func wrapLines(nd *ast.Node, depth int, c Config) {
	// This function looks at the unquoted ast.Value.Value string (i.e., with each Value's wrapping
	// quote chars removed). We need to remove these quotes, since otherwise they'll be re-flowed into
	// the body of the text.
	lengthBuffer := 4 // Even at depth 0 we have a 2-space indent and a pair of quotes
	maxLength := c.WrapStringsAtColumn - lengthBuffer - (depth * len(indentSpaces))

	str, err := unquote.Raw(nd)
	if err != nil {
		log.Errorf("skipping string wrapping on node %q (error unquoting string): %v", nd.Name, err)
		return
	}

	// Remove one from the max length since a trailing space may be added below.
	wrappedStr := wordwrap.WrapString(str, uint(maxLength)-1)
	lines := strings.Split(wrappedStr, "\n")
	newValues := make([]*ast.Value, 0, len(lines))
	// The Value objects have more than just the string in them. They also have any leading and
	// trailing comments. To maintain these comments we recycle the existing Value objects if
	// possible.
	var i int
	var line string
	for i, line = range lines {
		var v *ast.Value
		if len(nd.Values) > i {
			v = nd.Values[i]
		} else {
			v = &ast.Value{}
		}
		if i < len(lines)-1 {
			line = line + " "
		}
		v.Value = fmt.Sprintf(`"%s"`, line)
		newValues = append(newValues, v)
	}

	for i++; i < len(nd.Values); i++ {
		// If this executes, then the text was wrapped into less lines of text (less Values) than
		// previously. If any of these had comments on them, we collect them so they are not lost.
		v := nd.Values[i]
		nd.PostValuesComments = append(nd.PostValuesComments, v.PreComments...)
		if len(v.InlineComment) > 0 {
			nd.PostValuesComments = append(nd.PostValuesComments, v.InlineComment)
		}
	}

	nd.Values = newValues
}

func fixQuotes(s string) string {
	res := make([]byte, 0, len(s))
	res = append(res, '"')
	for i := 0; i < len(s); i++ {
		if s[i] == '"' {
			res = append(res, '\\')
		} else if s[i] == '\\' {
			res = append(res, s[i])
			i++
		}
		res = append(res, s[i])
	}
	res = append(res, '"')
	return string(res)
}

func unescapeQuotes(s string) string {
	res := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		// If we hit an escape sequence...
		if s[i] == '\\' {
			// ... keep the backslash unless it's in front of a quote ...
			if i == len(s)-1 || (s[i+1] != '"' && s[i+1] != '\'') {
				res = append(res, '\\')
			}
			// ... then point at the escaped character so it is output verbatim below.
			// Doing this within the loop (without "continue") ensures correct handling
			// of escaped backslashes.
			i++
		}
		if i < len(s) {
			res = append(res, s[i])
		}
	}
	return string(res)
}

func smartQuotes(s string) string {
	s = unescapeQuotes(s)
	if strings.Contains(s, "\"") && !strings.Contains(s, "'") {
		// If we hit this branch, the string doesn't contain any single quotes, and
		// is being wrapped in single quotes, so no escaping is needed.
		return "'" + s + "'"
	}
	// fixQuotes will wrap the string in double quotes, but will escape any
	// double quotes that appear within the string.
	return fixQuotes(s)
}

// DebugFormat returns a textual representation of the specified nodes for
// consumption by humans when debugging (e.g. in test failures). No guarantees
// are made about the specific output.
func DebugFormat(nodes []*ast.Node, depth int) string {
	res := []string{""}
	prefix := strings.Repeat(".", depth)
	for _, nd := range nodes {
		var value string
		if nd.Deleted {
			res = append(res, "DELETED")
		}
		if nd.Children != nil { // Also for 0 children.
			value = fmt.Sprintf("children:%s", DebugFormat(nd.Children, depth+1))
		} else {
			value = fmt.Sprintf("values: %v\n", nd.Values)
		}
		res = append(res,
			fmt.Sprintf("name: %q", nd.Name),
			fmt.Sprintf("PreComments: %q (len %d)", strings.Join(nd.PreComments, "\n"), len(nd.PreComments)),
			value)
	}
	return strings.Join(res, fmt.Sprintf("\n%s ", prefix))
}

// Pretty formats the nodes at the given indentation depth (0 = top-level).
func Pretty(nodes []*ast.Node, depth int) string {
	var result strings.Builder
	formatter{&result}.writeNodes(removeDeleted(nodes), depth, false /* isSameLine */, false /* asListItems */)
	return result.String()
}

func out(nodes []*ast.Node) []byte {
	var result bytes.Buffer
	formatter{&result}.writeNodes(removeDeleted(nodes), 0, false /* isSameLine */, false /* asListItems */)
	return result.Bytes()
}

// UnsortedFieldCollector collects UnsortedFields during parsing.
type UnsortedFieldCollector struct {
	fields map[string]UnsortedField
}

func newUnsortedFieldCollector() *UnsortedFieldCollector {
	return &UnsortedFieldCollector{
		fields: make(map[string]UnsortedField),
	}
}

// UnsortedFieldCollectorFunc collects UnsortedFields during parsing.
type UnsortedFieldCollectorFunc func(name string, line int32, parent string)

func (ufc *UnsortedFieldCollector) collect(name string, line int32, parent string) {
	ufc.fields[name] = UnsortedField{name, line, parent}
}

func (ufc *UnsortedFieldCollector) asError() error {
	if len(ufc.fields) == 0 {
		return nil
	}
	var fields []UnsortedField
	for _, f := range ufc.fields {
		fields = append(fields, f)
	}
	return &UnsortedFieldsError{fields}
}

func nodeSortFunction(c Config) NodeSortFunction {
	var sorter ast.NodeLess = nil
	unsortedFieldCollector := newUnsortedFieldCollector()
	for name, fieldOrder := range c.fieldSortOrder {
		sorter = ast.ChainNodeLess(sorter, ByFieldOrder(name, fieldOrder, unsortedFieldCollector.collect))
	}
	if c.SortFieldsByFieldName {
		sorter = ast.ChainNodeLess(sorter, ast.ByFieldName)
	}
	if c.SortRepeatedFieldsByContent {
		sorter = ast.ChainNodeLess(sorter, ast.ByFieldValue)
	}
	for _, sf := range c.SortRepeatedFieldsBySubfield {
		field, subfield := parseSubfieldSpec(sf)
		if subfield != "" {
			sorter = ast.ChainNodeLess(sorter, ast.ByFieldSubfield(field, subfield))
		}
	}
	if sorter != nil {
		return func(parent *ast.Node, ns []*ast.Node) error {
			sort.Stable(ast.SortableNodesWithParent(parent, ns, sorter))
			if c.RequireFieldSortOrderToMatchAllFieldsInNode {
				return unsortedFieldCollector.asError()
			}
			return nil
		}
	}
	return nil
}

// Returns the field and subfield parts of spec "{field}.{subfield}".
// Spec without a dot is considered to be "{subfield}".
func parseSubfieldSpec(subfieldSpec string) (field string, subfield string) {
	parts := strings.SplitN(subfieldSpec, ".", 2)
	if len(parts) == 1 {
		return "", parts[0]
	}
	return parts[0], parts[1]
}

func nodeFilterFunction(c Config) NodeFilterFunction {
	if c.RemoveDuplicateValuesForRepeatedFields {
		return RemoveDuplicates
	}
	return nil
}

// ByFieldOrder returns a NodeLess function that orders fields within a node named name
// by the order specified in fieldOrder. Nodes sorted but not specified by the field order
// are bubbled to the top and reported to unsortedCollector.
func ByFieldOrder(name string, fieldOrder []string, unsortedCollector UnsortedFieldCollectorFunc) ast.NodeLess {
	priorities := make(map[string]int)
	for i, fieldName := range fieldOrder {
		priorities[fieldName] = i + 1
	}
	return func(parent, ni, nj *ast.Node) bool {
		if parent != nil && parent.Name != name {
			return false
		}
		if parent == nil && name != RootName {
			return false
		}
		getNodePriority := func(node *ast.Node) int {
			// CommentOnly nodes don't set priority below, and default to MaxInt, which keeps them at the bottom
			prio := math.MaxInt

			// Unknown fields will get the int nil value of 0 from the order map, and bubble to the top.
			if !node.IsCommentOnly() {
				var ok bool
				prio, ok = priorities[node.Name]
				if !ok {
					unsortedCollector(node.Name, node.Start.Line, parent.Name)
				}
			}
			return prio
		}
		return getNodePriority(ni) < getNodePriority(nj)
	}
}

// stringWriter abstracts over bytes.Buffer and strings.Builder
type stringWriter interface {
	WriteString(s string) (int, error)
}

// formatter accumulates pretty-printed textproto contents into a stringWriter.
type formatter struct {
	stringWriter
}

func (f formatter) writeNodes(nodes []*ast.Node, depth int, isSameLine, asListItems bool) {
	indent := " "
	if !isSameLine {
		indent = strings.Repeat(indentSpaces, depth)
	}

	lastNonCommentIndex := 0
	if asListItems {
		for i := len(nodes) - 1; i >= 0; i-- {
			if !nodes[i].IsCommentOnly() {
				lastNonCommentIndex = i
				break
			}
		}
	}

	for index, nd := range nodes {
		for _, comment := range nd.PreComments {
			if len(comment) == 0 {
				if !(depth == 0 && index == 0) {
					f.WriteString("\n")
				}
				continue
			}
			f.WriteString(indent)
			f.WriteString(comment)
			f.WriteString("\n")
		}

		if nd.IsCommentOnly() {
			// The comments have been printed already, no more work to do.
			continue
		}
		f.WriteString(indent)
		// Node name may be empty in alternative-style textproto files, because they
		// contain a sequence of proto messages of the same type:
		//   { name: "first_msg" }
		//   { name: "second_msg" }
		// In all other cases, nd.Name is not empty and should be printed.
		if nd.Name != "" {
			f.WriteString(nd.Name)
			if !nd.SkipColon {
				f.WriteString(":")
			}

			// The space after the name is required for one-liners and message fields:
			//   title: "there was a space here"
			//   metadata: { ... }
			// In other cases, there is a newline right after the colon, so no space required.
			if nd.Children != nil || (len(nd.Values) == 1 && len(nd.Values[0].PreComments) == 0) || nd.ValuesAsList {
				f.WriteString(" ")
			}
		}

		if nd.ValuesAsList { // For ValuesAsList option we will preserve even empty list  `field: []`
			f.writeValuesAsList(nd, nd.Values, indent+indentSpaces)
		} else if len(nd.Values) > 0 {
			f.writeValues(nd, nd.Values, indent+indentSpaces)
		}
		if nd.Children != nil { // Also for 0 Children.
			if nd.ChildrenAsList {
				f.writeChildrenAsListItems(nd.Children, depth+1, isSameLine || nd.ChildrenSameLine)
			} else {
				f.writeChildren(nd.Children, depth+1, isSameLine || nd.ChildrenSameLine, nd.IsAngleBracket)
			}
		}

		if asListItems && index < lastNonCommentIndex {
			f.WriteString(",")
		}

		if (nd.Children != nil || nd.ValuesAsList) && len(nd.ClosingBraceComment) > 0 {
			f.WriteString(indentSpaces)
			f.WriteString(nd.ClosingBraceComment)
		}

		if !isSameLine {
			f.WriteString("\n")
		}
	}
}

func (f formatter) writeValues(nd *ast.Node, vals []*ast.Value, indent string) {
	if len(vals) == 0 {
		// This should never happen: formatValues can be called only if there are some values.
		return
	}
	sep := "\n" + indent
	if len(vals) == 1 && len(vals[0].PreComments) == 0 {
		sep = ""
	}
	for _, v := range vals {
		f.WriteString(sep)
		for _, comment := range v.PreComments {
			f.WriteString(comment)
			f.WriteString(sep)
		}
		f.WriteString(v.Value)
		if len(v.InlineComment) > 0 {
			f.WriteString(indentSpaces)
			f.WriteString(v.InlineComment)
		}
	}
	for _, comment := range nd.PostValuesComments {
		f.WriteString(sep)
		f.WriteString(comment)
	}
}

func (f formatter) writeValuesAsList(nd *ast.Node, vals []*ast.Value, indent string) {
	// Checks if it's possible to put whole list in a single line.
	sameLine := nd.ChildrenSameLine && len(nd.PostValuesComments) == 0
	if sameLine {
		// Parser found all children on a same line, but we need to check again.
		// It's possible that AST was modified after parsing.
		for _, val := range vals {
			if len(val.PreComments) > 0 || len(vals[0].InlineComment) > 0 {
				sameLine = false
				break
			}
		}
	}
	sep := ""
	if !sameLine {
		sep = "\n" + indent
	}
	f.WriteString("[")

	for idx, v := range vals {
		for _, comment := range v.PreComments {
			f.WriteString(sep)
			f.WriteString(comment)
		}
		f.WriteString(sep)
		f.WriteString(v.Value)
		if idx < len(vals)-1 { // Don't put trailing comma that fails Python parser.
			f.WriteString(",")
			if sameLine {
				f.WriteString(" ")
			}
		}
		if len(v.InlineComment) > 0 {
			f.WriteString(indentSpaces)
			f.WriteString(v.InlineComment)
		}
	}
	for _, comment := range nd.PostValuesComments {
		f.WriteString(sep)
		f.WriteString(comment)
	}
	f.WriteString(strings.Replace(sep, indentSpaces, "", 1))
	f.WriteString("]")
}

// writeChildren writes the child nodes. The result always ends with a closing brace.
func (f formatter) writeChildren(children []*ast.Node, depth int, sameLine, isAngleBracket bool) {
	openBrace := "{"
	closeBrace := "}"
	if isAngleBracket {
		openBrace = "<"
		closeBrace = ">"
	}
	switch {
	case sameLine && len(children) == 0:
		f.WriteString(openBrace + closeBrace)
	case sameLine:
		f.WriteString(openBrace)
		f.writeNodes(children, depth, sameLine, false /* asListItems */)
		f.WriteString(" " + closeBrace)
	default:
		f.WriteString(openBrace + "\n")
		f.writeNodes(children, depth, sameLine, false /* asListItems */)
		f.WriteString(strings.Repeat(indentSpaces, depth-1))
		f.WriteString(closeBrace)
	}
}

// writeChildrenAsListItems writes the child nodes as list items.
func (f formatter) writeChildrenAsListItems(children []*ast.Node, depth int, sameLine bool) {
	openBrace := "["
	closeBrace := "]"
	switch {
	case sameLine && len(children) == 0:
		f.WriteString(openBrace + closeBrace)
	case sameLine:
		f.WriteString(openBrace)
		f.writeNodes(children, depth, sameLine, true /* asListItems */)
		f.WriteString(" " + closeBrace)
	default:
		f.WriteString(openBrace + "\n")
		f.writeNodes(children, depth, sameLine, true /* asListItems */)
		f.WriteString(strings.Repeat(indentSpaces, depth-1))
		f.WriteString(closeBrace)
	}
}
