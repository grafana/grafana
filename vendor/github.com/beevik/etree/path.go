// Copyright 2015-2019 Brett Vickers.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package etree

import (
	"strconv"
	"strings"
)

/*
A Path is a string that represents a search path through an etree starting
from the document root or an arbitrary element. Paths are used with the
Element object's Find* methods to locate and return desired elements.

A Path consists of a series of slash-separated "selectors", each of which may
be modified by one or more bracket-enclosed "filters". Selectors are used to
traverse the etree from element to element, while filters are used to narrow
the list of candidate elements at each node.

Although etree Path strings are similar to XPath strings
(https://www.w3.org/TR/1999/REC-xpath-19991116/), they have a more limited set
of selectors and filtering options.

The following selectors are supported by etree Path strings:

    .               Select the current element.
    ..              Select the parent of the current element.
    *               Select all child elements of the current element.
    /               Select the root element when used at the start of a path.
    //              Select all descendants of the current element.
    tag             Select all child elements with a name matching the tag.

The following basic filters are supported by etree Path strings:

    [@attrib]       Keep elements with an attribute named attrib.
    [@attrib='val'] Keep elements with an attribute named attrib and value matching val.
    [tag]           Keep elements with a child element named tag.
    [tag='val']     Keep elements with a child element named tag and text matching val.
    [n]             Keep the n-th element, where n is a numeric index starting from 1.

The following function filters are also supported:

    [text()]                    Keep elements with non-empty text.
    [text()='val']              Keep elements whose text matches val.
    [local-name()='val']        Keep elements whose un-prefixed tag matches val.
    [name()='val']              Keep elements whose full tag exactly matches val.
    [namespace-prefix()='val']  Keep elements whose namespace prefix matches val.
    [namespace-uri()='val']     Keep elements whose namespace URI matches val.

Here are some examples of Path strings:

- Select the bookstore child element of the root element:
    /bookstore

- Beginning from the root element, select the title elements of all
descendant book elements having a 'category' attribute of 'WEB':
    //book[@category='WEB']/title

- Beginning from the current element, select the first descendant
book element with a title child element containing the text 'Great
Expectations':
    .//book[title='Great Expectations'][1]

- Beginning from the current element, select all child elements of
book elements with an attribute 'language' set to 'english':
    ./book/*[@language='english']

- Beginning from the current element, select all child elements of
book elements containing the text 'special':
    ./book/*[text()='special']

- Beginning from the current element, select all descendant book
elements whose title child element has a 'language' attribute of 'french':
    .//book/title[@language='french']/..

- Beginning from the current element, select all book elements
belonging to the http://www.w3.org/TR/html4/ namespace:
	.//book[namespace-uri()='http://www.w3.org/TR/html4/']

*/
type Path struct {
	segments []segment
}

// ErrPath is returned by path functions when an invalid etree path is provided.
type ErrPath string

// Error returns the string describing a path error.
func (err ErrPath) Error() string {
	return "etree: " + string(err)
}

// CompilePath creates an optimized version of an XPath-like string that
// can be used to query elements in an element tree.
func CompilePath(path string) (Path, error) {
	var comp compiler
	segments := comp.parsePath(path)
	if comp.err != ErrPath("") {
		return Path{nil}, comp.err
	}
	return Path{segments}, nil
}

// MustCompilePath creates an optimized version of an XPath-like string that
// can be used to query elements in an element tree.  Panics if an error
// occurs.  Use this function to create Paths when you know the path is
// valid (i.e., if it's hard-coded).
func MustCompilePath(path string) Path {
	p, err := CompilePath(path)
	if err != nil {
		panic(err)
	}
	return p
}

// A segment is a portion of a path between "/" characters.
// It contains one selector and zero or more [filters].
type segment struct {
	sel     selector
	filters []filter
}

func (seg *segment) apply(e *Element, p *pather) {
	seg.sel.apply(e, p)
	for _, f := range seg.filters {
		f.apply(p)
	}
}

// A selector selects XML elements for consideration by the
// path traversal.
type selector interface {
	apply(e *Element, p *pather)
}

// A filter pares down a list of candidate XML elements based
// on a path filter in [brackets].
type filter interface {
	apply(p *pather)
}

// A pather is helper object that traverses an element tree using
// a Path object.  It collects and deduplicates all elements matching
// the path query.
type pather struct {
	queue      fifo
	results    []*Element
	inResults  map[*Element]bool
	candidates []*Element
	scratch    []*Element // used by filters
}

// A node represents an element and the remaining path segments that
// should be applied against it by the pather.
type node struct {
	e        *Element
	segments []segment
}

func newPather() *pather {
	return &pather{
		results:    make([]*Element, 0),
		inResults:  make(map[*Element]bool),
		candidates: make([]*Element, 0),
		scratch:    make([]*Element, 0),
	}
}

// traverse follows the path from the element e, collecting
// and then returning all elements that match the path's selectors
// and filters.
func (p *pather) traverse(e *Element, path Path) []*Element {
	for p.queue.add(node{e, path.segments}); p.queue.len() > 0; {
		p.eval(p.queue.remove().(node))
	}
	return p.results
}

// eval evalutes the current path node by applying the remaining
// path's selector rules against the node's element.
func (p *pather) eval(n node) {
	p.candidates = p.candidates[0:0]
	seg, remain := n.segments[0], n.segments[1:]
	seg.apply(n.e, p)

	if len(remain) == 0 {
		for _, c := range p.candidates {
			if in := p.inResults[c]; !in {
				p.inResults[c] = true
				p.results = append(p.results, c)
			}
		}
	} else {
		for _, c := range p.candidates {
			p.queue.add(node{c, remain})
		}
	}
}

// A compiler generates a compiled path from a path string.
type compiler struct {
	err ErrPath
}

// parsePath parses an XPath-like string describing a path
// through an element tree and returns a slice of segment
// descriptors.
func (c *compiler) parsePath(path string) []segment {
	// If path ends with //, fix it
	if strings.HasSuffix(path, "//") {
		path = path + "*"
	}

	var segments []segment

	// Check for an absolute path
	if strings.HasPrefix(path, "/") {
		segments = append(segments, segment{new(selectRoot), []filter{}})
		path = path[1:]
	}

	// Split path into segments
	for _, s := range splitPath(path) {
		segments = append(segments, c.parseSegment(s))
		if c.err != ErrPath("") {
			break
		}
	}
	return segments
}

func splitPath(path string) []string {
	pieces := make([]string, 0)
	start := 0
	inquote := false
	for i := 0; i+1 <= len(path); i++ {
		if path[i] == '\'' {
			inquote = !inquote
		} else if path[i] == '/' && !inquote {
			pieces = append(pieces, path[start:i])
			start = i + 1
		}
	}
	return append(pieces, path[start:])
}

// parseSegment parses a path segment between / characters.
func (c *compiler) parseSegment(path string) segment {
	pieces := strings.Split(path, "[")
	seg := segment{
		sel:     c.parseSelector(pieces[0]),
		filters: []filter{},
	}
	for i := 1; i < len(pieces); i++ {
		fpath := pieces[i]
		if fpath[len(fpath)-1] != ']' {
			c.err = ErrPath("path has invalid filter [brackets].")
			break
		}
		seg.filters = append(seg.filters, c.parseFilter(fpath[:len(fpath)-1]))
	}
	return seg
}

// parseSelector parses a selector at the start of a path segment.
func (c *compiler) parseSelector(path string) selector {
	switch path {
	case ".":
		return new(selectSelf)
	case "..":
		return new(selectParent)
	case "*":
		return new(selectChildren)
	case "":
		return new(selectDescendants)
	default:
		return newSelectChildrenByTag(path)
	}
}

var fnTable = map[string]struct {
	hasFn    func(e *Element) bool
	getValFn func(e *Element) string
}{
	"local-name":       {nil, (*Element).name},
	"name":             {nil, (*Element).FullTag},
	"namespace-prefix": {nil, (*Element).namespacePrefix},
	"namespace-uri":    {nil, (*Element).NamespaceURI},
	"text":             {(*Element).hasText, (*Element).Text},
}

// parseFilter parses a path filter contained within [brackets].
func (c *compiler) parseFilter(path string) filter {
	if len(path) == 0 {
		c.err = ErrPath("path contains an empty filter expression.")
		return nil
	}

	// Filter contains [@attr='val'], [fn()='val'], or [tag='val']?
	eqindex := strings.Index(path, "='")
	if eqindex >= 0 {
		rindex := nextIndex(path, "'", eqindex+2)
		if rindex != len(path)-1 {
			c.err = ErrPath("path has mismatched filter quotes.")
			return nil
		}

		key := path[:eqindex]
		value := path[eqindex+2 : rindex]

		switch {
		case key[0] == '@':
			return newFilterAttrVal(key[1:], value)
		case strings.HasSuffix(key, "()"):
			fn := key[:len(key)-2]
			if t, ok := fnTable[fn]; ok && t.getValFn != nil {
				return newFilterFuncVal(t.getValFn, value)
			}
			c.err = ErrPath("path has unknown function " + fn)
			return nil
		default:
			return newFilterChildText(key, value)
		}
	}

	// Filter contains [@attr], [N], [tag] or [fn()]
	switch {
	case path[0] == '@':
		return newFilterAttr(path[1:])
	case strings.HasSuffix(path, "()"):
		fn := path[:len(path)-2]
		if t, ok := fnTable[fn]; ok && t.hasFn != nil {
			return newFilterFunc(t.hasFn)
		}
		c.err = ErrPath("path has unknown function " + fn)
		return nil
	case isInteger(path):
		pos, _ := strconv.Atoi(path)
		switch {
		case pos > 0:
			return newFilterPos(pos - 1)
		default:
			return newFilterPos(pos)
		}
	default:
		return newFilterChild(path)
	}
}

// selectSelf selects the current element into the candidate list.
type selectSelf struct{}

func (s *selectSelf) apply(e *Element, p *pather) {
	p.candidates = append(p.candidates, e)
}

// selectRoot selects the element's root node.
type selectRoot struct{}

func (s *selectRoot) apply(e *Element, p *pather) {
	root := e
	for root.parent != nil {
		root = root.parent
	}
	p.candidates = append(p.candidates, root)
}

// selectParent selects the element's parent into the candidate list.
type selectParent struct{}

func (s *selectParent) apply(e *Element, p *pather) {
	if e.parent != nil {
		p.candidates = append(p.candidates, e.parent)
	}
}

// selectChildren selects the element's child elements into the
// candidate list.
type selectChildren struct{}

func (s *selectChildren) apply(e *Element, p *pather) {
	for _, c := range e.Child {
		if c, ok := c.(*Element); ok {
			p.candidates = append(p.candidates, c)
		}
	}
}

// selectDescendants selects all descendant child elements
// of the element into the candidate list.
type selectDescendants struct{}

func (s *selectDescendants) apply(e *Element, p *pather) {
	var queue fifo
	for queue.add(e); queue.len() > 0; {
		e := queue.remove().(*Element)
		p.candidates = append(p.candidates, e)
		for _, c := range e.Child {
			if c, ok := c.(*Element); ok {
				queue.add(c)
			}
		}
	}
}

// selectChildrenByTag selects into the candidate list all child
// elements of the element having the specified tag.
type selectChildrenByTag struct {
	space, tag string
}

func newSelectChildrenByTag(path string) *selectChildrenByTag {
	s, l := spaceDecompose(path)
	return &selectChildrenByTag{s, l}
}

func (s *selectChildrenByTag) apply(e *Element, p *pather) {
	for _, c := range e.Child {
		if c, ok := c.(*Element); ok && spaceMatch(s.space, c.Space) && s.tag == c.Tag {
			p.candidates = append(p.candidates, c)
		}
	}
}

// filterPos filters the candidate list, keeping only the
// candidate at the specified index.
type filterPos struct {
	index int
}

func newFilterPos(pos int) *filterPos {
	return &filterPos{pos}
}

func (f *filterPos) apply(p *pather) {
	if f.index >= 0 {
		if f.index < len(p.candidates) {
			p.scratch = append(p.scratch, p.candidates[f.index])
		}
	} else {
		if -f.index <= len(p.candidates) {
			p.scratch = append(p.scratch, p.candidates[len(p.candidates)+f.index])
		}
	}
	p.candidates, p.scratch = p.scratch, p.candidates[0:0]
}

// filterAttr filters the candidate list for elements having
// the specified attribute.
type filterAttr struct {
	space, key string
}

func newFilterAttr(str string) *filterAttr {
	s, l := spaceDecompose(str)
	return &filterAttr{s, l}
}

func (f *filterAttr) apply(p *pather) {
	for _, c := range p.candidates {
		for _, a := range c.Attr {
			if spaceMatch(f.space, a.Space) && f.key == a.Key {
				p.scratch = append(p.scratch, c)
				break
			}
		}
	}
	p.candidates, p.scratch = p.scratch, p.candidates[0:0]
}

// filterAttrVal filters the candidate list for elements having
// the specified attribute with the specified value.
type filterAttrVal struct {
	space, key, val string
}

func newFilterAttrVal(str, value string) *filterAttrVal {
	s, l := spaceDecompose(str)
	return &filterAttrVal{s, l, value}
}

func (f *filterAttrVal) apply(p *pather) {
	for _, c := range p.candidates {
		for _, a := range c.Attr {
			if spaceMatch(f.space, a.Space) && f.key == a.Key && f.val == a.Value {
				p.scratch = append(p.scratch, c)
				break
			}
		}
	}
	p.candidates, p.scratch = p.scratch, p.candidates[0:0]
}

// filterFunc filters the candidate list for elements satisfying a custom
// boolean function.
type filterFunc struct {
	fn func(e *Element) bool
}

func newFilterFunc(fn func(e *Element) bool) *filterFunc {
	return &filterFunc{fn}
}

func (f *filterFunc) apply(p *pather) {
	for _, c := range p.candidates {
		if f.fn(c) {
			p.scratch = append(p.scratch, c)
		}
	}
	p.candidates, p.scratch = p.scratch, p.candidates[0:0]
}

// filterFuncVal filters the candidate list for elements containing a value
// matching the result of a custom function.
type filterFuncVal struct {
	fn  func(e *Element) string
	val string
}

func newFilterFuncVal(fn func(e *Element) string, value string) *filterFuncVal {
	return &filterFuncVal{fn, value}
}

func (f *filterFuncVal) apply(p *pather) {
	for _, c := range p.candidates {
		if f.fn(c) == f.val {
			p.scratch = append(p.scratch, c)
		}
	}
	p.candidates, p.scratch = p.scratch, p.candidates[0:0]
}

// filterChild filters the candidate list for elements having
// a child element with the specified tag.
type filterChild struct {
	space, tag string
}

func newFilterChild(str string) *filterChild {
	s, l := spaceDecompose(str)
	return &filterChild{s, l}
}

func (f *filterChild) apply(p *pather) {
	for _, c := range p.candidates {
		for _, cc := range c.Child {
			if cc, ok := cc.(*Element); ok &&
				spaceMatch(f.space, cc.Space) &&
				f.tag == cc.Tag {
				p.scratch = append(p.scratch, c)
			}
		}
	}
	p.candidates, p.scratch = p.scratch, p.candidates[0:0]
}

// filterChildText filters the candidate list for elements having
// a child element with the specified tag and text.
type filterChildText struct {
	space, tag, text string
}

func newFilterChildText(str, text string) *filterChildText {
	s, l := spaceDecompose(str)
	return &filterChildText{s, l, text}
}

func (f *filterChildText) apply(p *pather) {
	for _, c := range p.candidates {
		for _, cc := range c.Child {
			if cc, ok := cc.(*Element); ok &&
				spaceMatch(f.space, cc.Space) &&
				f.tag == cc.Tag &&
				f.text == cc.Text() {
				p.scratch = append(p.scratch, c)
			}
		}
	}
	p.candidates, p.scratch = p.scratch, p.candidates[0:0]
}
