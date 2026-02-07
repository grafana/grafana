// Copyright 2015-2019 Brett Vickers.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package etree provides XML services through an Element Tree
// abstraction.
package etree

import (
	"bufio"
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"os"
	"slices"
	"strings"
)

const (
	// NoIndent is used with the IndentSettings record to remove all
	// indenting.
	NoIndent = -1
)

// ErrXML is returned when XML parsing fails due to incorrect formatting.
var ErrXML = errors.New("etree: invalid XML format")

// cdataPrefix is used to detect CDATA text when ReadSettings.PreserveCData is
// true.
var cdataPrefix = []byte("<![CDATA[")

// ReadSettings determine the default behavior of the Document's ReadFrom*
// functions.
type ReadSettings struct {
	// CharsetReader, if non-nil, defines a function to generate
	// charset-conversion readers, converting from the provided non-UTF-8
	// charset into UTF-8. If nil, the ReadFrom* functions will use a
	// "pass-through" CharsetReader that performs no conversion on the reader's
	// data regardless of the value of the "charset" encoding string. Default:
	// nil.
	CharsetReader func(charset string, input io.Reader) (io.Reader, error)

	// Permissive allows input containing common mistakes such as missing tags
	// or attribute values. Default: false.
	Permissive bool

	// Preserve CDATA character data blocks when decoding XML (instead of
	// converting it to normal character text). This entails additional
	// processing and memory usage during ReadFrom* operations. Default:
	// false.
	PreserveCData bool

	// When an element has two or more attributes with the same name,
	// preserve them instead of keeping only one. Default: false.
	PreserveDuplicateAttrs bool

	// ValidateInput forces all ReadFrom* functions to validate that the
	// provided input is composed of "well-formed"(*) XML before processing it.
	// If invalid XML is detected, the ReadFrom* functions return an error.
	// Because this option requires the input to be processed twice, it incurs a
	// significant performance penalty. Default: false.
	//
	// (*) Note that this definition of "well-formed" is in the context of the
	// go standard library's encoding/xml package. Go's encoding/xml package
	// does not, in fact, guarantee well-formed XML as specified by the W3C XML
	// recommendation. See: https://github.com/golang/go/issues/68299
	ValidateInput bool

	// Entity to be passed to standard xml.Decoder. Default: nil.
	Entity map[string]string

	// When Permissive is true, AutoClose indicates a set of elements to
	// consider closed immediately after they are opened, regardless of
	// whether an end element is present. Commonly set to xml.HTMLAutoClose.
	// Default: nil.
	AutoClose []string
}

// defaultCharsetReader is used by the xml decoder when the ReadSettings
// CharsetReader value is nil. It behaves as a "pass-through", ignoring
// the requested charset parameter and skipping conversion altogether.
func defaultCharsetReader(charset string, input io.Reader) (io.Reader, error) {
	return input, nil
}

// dup creates a duplicate of the ReadSettings object.
func (s *ReadSettings) dup() ReadSettings {
	var entityCopy map[string]string
	if s.Entity != nil {
		entityCopy = make(map[string]string)
		for k, v := range s.Entity {
			entityCopy[k] = v
		}
	}
	return ReadSettings{
		CharsetReader: s.CharsetReader,
		Permissive:    s.Permissive,
		Entity:        entityCopy,
	}
}

// WriteSettings determine the behavior of the Document's WriteTo* functions.
type WriteSettings struct {
	// CanonicalEndTags forces the production of XML end tags, even for
	// elements that have no child elements. Default: false.
	CanonicalEndTags bool

	// CanonicalText forces the production of XML character references for
	// text data characters &, <, and >. If false, XML character references
	// are also produced for " and '. Default: false.
	CanonicalText bool

	// CanonicalAttrVal forces the production of XML character references for
	// attribute value characters &, < and ". If false, XML character
	// references are also produced for > and '. Default: false.
	CanonicalAttrVal bool

	// AttrSingleQuote causes attributes to use single quotes (attr='example')
	// instead of double quotes (attr = "example") when set to true. Default:
	// false.
	AttrSingleQuote bool

	// UseCRLF causes the document's Indent* functions to use a carriage return
	// followed by a linefeed ("\r\n") when outputting a newline. If false,
	// only a linefeed is used ("\n"). Default: false.
	//
	// Deprecated: UseCRLF is deprecated. Use IndentSettings.UseCRLF instead.
	UseCRLF bool
}

// dup creates a duplicate of the WriteSettings object.
func (s *WriteSettings) dup() WriteSettings {
	return *s
}

// IndentSettings determine the behavior of the Document's Indent* functions.
type IndentSettings struct {
	// Spaces indicates the number of spaces to insert for each level of
	// indentation. Set to etree.NoIndent to remove all indentation. Ignored
	// when UseTabs is true. Default: 4.
	Spaces int

	// UseTabs causes tabs to be used instead of spaces when indenting.
	// Default: false.
	UseTabs bool

	// UseCRLF causes newlines to be written as a carriage return followed by
	// a linefeed ("\r\n"). If false, only a linefeed character is output
	// for a newline ("\n"). Default: false.
	UseCRLF bool

	// PreserveLeafWhitespace causes indent functions to preserve whitespace
	// within XML elements containing only non-CDATA character data. Default:
	// false.
	PreserveLeafWhitespace bool

	// SuppressTrailingWhitespace suppresses the generation of a trailing
	// whitespace characters (such as newlines) at the end of the indented
	// document. Default: false.
	SuppressTrailingWhitespace bool
}

// NewIndentSettings creates a default IndentSettings record.
func NewIndentSettings() *IndentSettings {
	return &IndentSettings{
		Spaces:                     4,
		UseTabs:                    false,
		UseCRLF:                    false,
		PreserveLeafWhitespace:     false,
		SuppressTrailingWhitespace: false,
	}
}

type indentFunc func(depth int) string

func getIndentFunc(s *IndentSettings) indentFunc {
	if s.UseTabs {
		if s.UseCRLF {
			return func(depth int) string { return indentCRLF(depth, indentTabs) }
		} else {
			return func(depth int) string { return indentLF(depth, indentTabs) }
		}
	} else {
		if s.Spaces < 0 {
			return func(depth int) string { return "" }
		} else if s.UseCRLF {
			return func(depth int) string { return indentCRLF(depth*s.Spaces, indentSpaces) }
		} else {
			return func(depth int) string { return indentLF(depth*s.Spaces, indentSpaces) }
		}
	}
}

// Writer is the interface that wraps the Write* functions called by each token
// type's WriteTo function.
type Writer interface {
	io.StringWriter
	io.ByteWriter
	io.Writer
}

// A Token is an interface type used to represent XML elements, character
// data, CDATA sections, XML comments, XML directives, and XML processing
// instructions.
type Token interface {
	Parent() *Element
	Index() int
	WriteTo(w Writer, s *WriteSettings)
	dup(parent *Element) Token
	setParent(parent *Element)
	setIndex(index int)
}

// A Document is a container holding a complete XML tree.
//
// A document has a single embedded element, which contains zero or more child
// tokens, one of which is usually the root element. The embedded element may
// include other children such as processing instruction tokens or character
// data tokens. The document's embedded element is never directly serialized;
// only its children are.
//
// A document also contains read and write settings, which influence the way
// the document is deserialized, serialized, and indented.
type Document struct {
	Element
	ReadSettings  ReadSettings
	WriteSettings WriteSettings
}

// An Element represents an XML element, its attributes, and its child tokens.
type Element struct {
	Space, Tag string   // namespace prefix and tag
	Attr       []Attr   // key-value attribute pairs
	Child      []Token  // child tokens (elements, comments, etc.)
	parent     *Element // parent element
	index      int      // token index in parent's children
}

// An Attr represents a key-value attribute within an XML element.
type Attr struct {
	Space, Key string   // The attribute's namespace prefix and key
	Value      string   // The attribute value string
	element    *Element // element containing the attribute
}

// charDataFlags are used with CharData tokens to store additional settings.
type charDataFlags uint8

const (
	// The CharData contains only whitespace.
	whitespaceFlag charDataFlags = 1 << iota

	// The CharData contains a CDATA section.
	cdataFlag
)

// CharData may be used to represent simple text data or a CDATA section
// within an XML document. The Data property should never be modified
// directly; use the SetData function instead.
type CharData struct {
	Data   string // the simple text or CDATA section content
	parent *Element
	index  int
	flags  charDataFlags
}

// A Comment represents an XML comment.
type Comment struct {
	Data   string // the comment's text
	parent *Element
	index  int
}

// A Directive represents an XML directive.
type Directive struct {
	Data   string // the directive string
	parent *Element
	index  int
}

// A ProcInst represents an XML processing instruction.
type ProcInst struct {
	Target string // the processing instruction target
	Inst   string // the processing instruction value
	parent *Element
	index  int
}

// NewDocument creates an XML document without a root element.
func NewDocument() *Document {
	return &Document{
		Element: Element{Child: make([]Token, 0)},
	}
}

// NewDocumentWithRoot creates an XML document and sets the element 'e' as its
// root element. If the element 'e' is already part of another document, it is
// first removed from its existing document.
func NewDocumentWithRoot(e *Element) *Document {
	d := NewDocument()
	d.SetRoot(e)
	return d
}

// Copy returns a recursive, deep copy of the document.
func (d *Document) Copy() *Document {
	return &Document{
		Element:       *(d.Element.dup(nil).(*Element)),
		ReadSettings:  d.ReadSettings.dup(),
		WriteSettings: d.WriteSettings.dup(),
	}
}

// Root returns the root element of the document. It returns nil if there is
// no root element.
func (d *Document) Root() *Element {
	for _, t := range d.Child {
		if c, ok := t.(*Element); ok {
			return c
		}
	}
	return nil
}

// SetRoot replaces the document's root element with the element 'e'. If the
// document already has a root element when this function is called, then the
// existing root element is unbound from the document. If the element 'e' is
// part of another document, then it is unbound from the other document.
func (d *Document) SetRoot(e *Element) {
	if e.parent != nil {
		e.parent.RemoveChild(e)
	}

	// If there is already a root element, replace it.
	p := &d.Element
	for i, t := range p.Child {
		if _, ok := t.(*Element); ok {
			t.setParent(nil)
			t.setIndex(-1)
			p.Child[i] = e
			e.setParent(p)
			e.setIndex(i)
			return
		}
	}

	// No existing root element, so add it.
	p.addChild(e)
}

// ReadFrom reads XML from the reader 'r' into this document. The function
// returns the number of bytes read and any error encountered.
func (d *Document) ReadFrom(r io.Reader) (n int64, err error) {
	if d.ReadSettings.ValidateInput {
		b, err := io.ReadAll(r)
		if err != nil {
			return 0, err
		}
		if err := validateXML(bytes.NewReader(b), d.ReadSettings); err != nil {
			return 0, err
		}
		r = bytes.NewReader(b)
	}
	return d.Element.readFrom(r, d.ReadSettings)
}

// ReadFromFile reads XML from a local file at path 'filepath' into this
// document.
func (d *Document) ReadFromFile(filepath string) error {
	f, err := os.Open(filepath)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = d.ReadFrom(f)
	return err
}

// ReadFromBytes reads XML from the byte slice 'b' into the this document.
func (d *Document) ReadFromBytes(b []byte) error {
	if d.ReadSettings.ValidateInput {
		if err := validateXML(bytes.NewReader(b), d.ReadSettings); err != nil {
			return err
		}
	}
	_, err := d.Element.readFrom(bytes.NewReader(b), d.ReadSettings)
	return err
}

// ReadFromString reads XML from the string 's' into this document.
func (d *Document) ReadFromString(s string) error {
	if d.ReadSettings.ValidateInput {
		if err := validateXML(strings.NewReader(s), d.ReadSettings); err != nil {
			return err
		}
	}
	_, err := d.Element.readFrom(strings.NewReader(s), d.ReadSettings)
	return err
}

// validateXML determines if the data read from the reader 'r' contains
// well-formed XML according to the rules set by the go xml package.
func validateXML(r io.Reader, settings ReadSettings) error {
	dec := newDecoder(r, settings)
	err := dec.Decode(new(interface{}))
	if err != nil {
		return err
	}

	// If there are any trailing tokens after unmarshalling with Decode(),
	// then the XML input didn't terminate properly.
	_, err = dec.Token()
	if err == io.EOF {
		return nil
	}
	return ErrXML
}

// newDecoder creates an XML decoder for the reader 'r' configured using
// the provided read settings.
func newDecoder(r io.Reader, settings ReadSettings) *xml.Decoder {
	d := xml.NewDecoder(r)
	d.CharsetReader = settings.CharsetReader
	if d.CharsetReader == nil {
		d.CharsetReader = defaultCharsetReader
	}
	d.Strict = !settings.Permissive
	d.Entity = settings.Entity
	d.AutoClose = settings.AutoClose
	return d
}

// WriteTo serializes the document out to the writer 'w'. The function returns
// the number of bytes written and any error encountered.
func (d *Document) WriteTo(w io.Writer) (n int64, err error) {
	xw := newXmlWriter(w)
	b := bufio.NewWriter(xw)
	for _, c := range d.Child {
		c.WriteTo(b, &d.WriteSettings)
	}
	err, n = b.Flush(), xw.bytes
	return
}

// WriteToFile serializes the document out to the file at path 'filepath'.
func (d *Document) WriteToFile(filepath string) error {
	f, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = d.WriteTo(f)
	return err
}

// WriteToBytes serializes this document into a slice of bytes.
func (d *Document) WriteToBytes() (b []byte, err error) {
	var buf bytes.Buffer
	if _, err = d.WriteTo(&buf); err != nil {
		return
	}
	return buf.Bytes(), nil
}

// WriteToString serializes this document into a string.
func (d *Document) WriteToString() (s string, err error) {
	var b []byte
	if b, err = d.WriteToBytes(); err != nil {
		return
	}
	return string(b), nil
}

// Indent modifies the document's element tree by inserting character data
// tokens containing newlines and spaces for indentation. The amount of
// indentation per depth level is given by the 'spaces' parameter. Other than
// the number of spaces, default IndentSettings are used.
func (d *Document) Indent(spaces int) {
	s := NewIndentSettings()
	s.Spaces = spaces
	d.IndentWithSettings(s)
}

// IndentTabs modifies the document's element tree by inserting CharData
// tokens containing newlines and tabs for indentation. One tab is used per
// indentation level. Other than the use of tabs, default IndentSettings
// are used.
func (d *Document) IndentTabs() {
	s := NewIndentSettings()
	s.UseTabs = true
	d.IndentWithSettings(s)
}

// IndentWithSettings modifies the document's element tree by inserting
// character data tokens containing newlines and indentation. The behavior
// of the indentation algorithm is configured by the indent settings.
func (d *Document) IndentWithSettings(s *IndentSettings) {
	// WriteSettings.UseCRLF is deprecated. Until removed from the package, it
	// overrides IndentSettings.UseCRLF when true.
	if d.WriteSettings.UseCRLF {
		s.UseCRLF = true
	}

	d.Element.indent(0, getIndentFunc(s), s)

	if s.SuppressTrailingWhitespace {
		d.Element.stripTrailingWhitespace()
	}
}

// Unindent modifies the document's element tree by removing character data
// tokens containing only whitespace. Other than the removal of indentation,
// default IndentSettings are used.
func (d *Document) Unindent() {
	s := NewIndentSettings()
	s.Spaces = NoIndent
	d.IndentWithSettings(s)
}

// NewElement creates an unparented element with the specified tag (i.e.,
// name). The tag may include a namespace prefix followed by a colon.
func NewElement(tag string) *Element {
	space, stag := spaceDecompose(tag)
	return newElement(space, stag, nil)
}

// newElement is a helper function that creates an element and binds it to
// a parent element if possible.
func newElement(space, tag string, parent *Element) *Element {
	e := &Element{
		Space:  space,
		Tag:    tag,
		Attr:   make([]Attr, 0),
		Child:  make([]Token, 0),
		parent: parent,
		index:  -1,
	}
	if parent != nil {
		parent.addChild(e)
	}
	return e
}

// Copy creates a recursive, deep copy of the element and all its attributes
// and children. The returned element has no parent but can be parented to a
// another element using AddChild, or added to a document with SetRoot or
// NewDocumentWithRoot.
func (e *Element) Copy() *Element {
	return e.dup(nil).(*Element)
}

// FullTag returns the element e's complete tag, including namespace prefix if
// present.
func (e *Element) FullTag() string {
	if e.Space == "" {
		return e.Tag
	}
	return e.Space + ":" + e.Tag
}

// NamespaceURI returns the XML namespace URI associated with the element. If
// the element is part of the XML default namespace, NamespaceURI returns the
// empty string.
func (e *Element) NamespaceURI() string {
	if e.Space == "" {
		return e.findDefaultNamespaceURI()
	}
	return e.findLocalNamespaceURI(e.Space)
}

// findLocalNamespaceURI finds the namespace URI corresponding to the
// requested prefix.
func (e *Element) findLocalNamespaceURI(prefix string) string {
	for _, a := range e.Attr {
		if a.Space == "xmlns" && a.Key == prefix {
			return a.Value
		}
	}

	if e.parent == nil {
		return ""
	}

	return e.parent.findLocalNamespaceURI(prefix)
}

// findDefaultNamespaceURI finds the default namespace URI of the element.
func (e *Element) findDefaultNamespaceURI() string {
	for _, a := range e.Attr {
		if a.Space == "" && a.Key == "xmlns" {
			return a.Value
		}
	}

	if e.parent == nil {
		return ""
	}

	return e.parent.findDefaultNamespaceURI()
}

// namespacePrefix returns the namespace prefix associated with the element.
func (e *Element) namespacePrefix() string {
	return e.Space
}

// name returns the tag associated with the element.
func (e *Element) name() string {
	return e.Tag
}

// ReindexChildren recalculates the index values of the element's child
// tokens. This is necessary only if you have manually manipulated the
// element's `Child` array.
func (e *Element) ReindexChildren() {
	for i := 0; i < len(e.Child); i++ {
		e.Child[i].setIndex(i)
	}
}

// Text returns all character data immediately following the element's opening
// tag.
func (e *Element) Text() string {
	if len(e.Child) == 0 {
		return ""
	}

	text := ""
	for _, ch := range e.Child {
		if cd, ok := ch.(*CharData); ok {
			if text == "" {
				text = cd.Data
			} else {
				text += cd.Data
			}
		} else if _, ok := ch.(*Comment); ok {
			// ignore
		} else {
			break
		}
	}
	return text
}

// SetText replaces all character data immediately following an element's
// opening tag with the requested string.
func (e *Element) SetText(text string) {
	e.replaceText(0, text, 0)
}

// SetCData replaces all character data immediately following an element's
// opening tag with a CDATA section.
func (e *Element) SetCData(text string) {
	e.replaceText(0, text, cdataFlag)
}

// Tail returns all character data immediately following the element's end
// tag.
func (e *Element) Tail() string {
	if e.Parent() == nil {
		return ""
	}

	p := e.Parent()
	i := e.Index()

	text := ""
	for _, ch := range p.Child[i+1:] {
		if cd, ok := ch.(*CharData); ok {
			if text == "" {
				text = cd.Data
			} else {
				text += cd.Data
			}
		} else {
			break
		}
	}
	return text
}

// SetTail replaces all character data immediately following the element's end
// tag with the requested string.
func (e *Element) SetTail(text string) {
	if e.Parent() == nil {
		return
	}

	p := e.Parent()
	p.replaceText(e.Index()+1, text, 0)
}

// replaceText is a helper function that replaces a series of chardata tokens
// starting at index i with the requested text.
func (e *Element) replaceText(i int, text string, flags charDataFlags) {
	end := e.findTermCharDataIndex(i)

	switch {
	case end == i:
		if text != "" {
			// insert a new chardata token at index i
			cd := newCharData(text, flags, nil)
			e.InsertChildAt(i, cd)
		}

	case end == i+1:
		if text == "" {
			// remove the chardata token at index i
			e.RemoveChildAt(i)
		} else {
			// replace the first and only character token at index i
			cd := e.Child[i].(*CharData)
			cd.Data, cd.flags = text, flags
		}

	default:
		if text == "" {
			// remove all chardata tokens starting from index i
			copy(e.Child[i:], e.Child[end:])
			removed := end - i
			e.Child = e.Child[:len(e.Child)-removed]
			for j := i; j < len(e.Child); j++ {
				e.Child[j].setIndex(j)
			}
		} else {
			// replace the first chardata token at index i and remove all
			// subsequent chardata tokens
			cd := e.Child[i].(*CharData)
			cd.Data, cd.flags = text, flags
			copy(e.Child[i+1:], e.Child[end:])
			removed := end - (i + 1)
			e.Child = e.Child[:len(e.Child)-removed]
			for j := i + 1; j < len(e.Child); j++ {
				e.Child[j].setIndex(j)
			}
		}
	}
}

// findTermCharDataIndex finds the index of the first child token that isn't
// a CharData token. It starts from the requested start index.
func (e *Element) findTermCharDataIndex(start int) int {
	for i := start; i < len(e.Child); i++ {
		if _, ok := e.Child[i].(*CharData); !ok {
			return i
		}
	}
	return len(e.Child)
}

// CreateElement creates a new element with the specified tag (i.e., name) and
// adds it as the last child token of this element. The tag may include a
// prefix followed by a colon.
func (e *Element) CreateElement(tag string) *Element {
	space, stag := spaceDecompose(tag)
	return newElement(space, stag, e)
}

// AddChild adds the token 't' as the last child of the element. If token 't'
// was already the child of another element, it is first removed from its
// parent element.
func (e *Element) AddChild(t Token) {
	if t.Parent() != nil {
		t.Parent().RemoveChild(t)
	}
	e.addChild(t)
}

// InsertChild inserts the token 't' into this element's list of children just
// before the element's existing child token 'ex'. If the existing element
// 'ex' does not appear in this element's list of child tokens, then 't' is
// added to the end of this element's list of child tokens. If token 't' is
// already the child of another element, it is first removed from the other
// element's list of child tokens.
//
// Deprecated: InsertChild is deprecated. Use InsertChildAt instead.
func (e *Element) InsertChild(ex Token, t Token) {
	if ex == nil || ex.Parent() != e {
		e.AddChild(t)
		return
	}

	if t.Parent() != nil {
		t.Parent().RemoveChild(t)
	}

	t.setParent(e)

	i := ex.Index()
	e.Child = append(e.Child, nil)
	copy(e.Child[i+1:], e.Child[i:])
	e.Child[i] = t

	for j := i; j < len(e.Child); j++ {
		e.Child[j].setIndex(j)
	}
}

// InsertChildAt inserts the token 't' into this element's list of child
// tokens just before the requested 'index'. If the index is greater than or
// equal to the length of the list of child tokens, then the token 't' is
// added to the end of the list of child tokens.
func (e *Element) InsertChildAt(index int, t Token) {
	if index >= len(e.Child) {
		e.AddChild(t)
		return
	}

	if t.Parent() != nil {
		if t.Parent() == e && t.Index() > index {
			index--
		}
		t.Parent().RemoveChild(t)
	}

	t.setParent(e)

	e.Child = append(e.Child, nil)
	copy(e.Child[index+1:], e.Child[index:])
	e.Child[index] = t

	for j := index; j < len(e.Child); j++ {
		e.Child[j].setIndex(j)
	}
}

// RemoveChild attempts to remove the token 't' from this element's list of
// child tokens. If the token 't' was a child of this element, then it is
// removed and returned. Otherwise, nil is returned.
func (e *Element) RemoveChild(t Token) Token {
	if t.Parent() != e {
		return nil
	}
	return e.RemoveChildAt(t.Index())
}

// RemoveChildAt removes the child token appearing in slot 'index' of this
// element's list of child tokens. The removed child token is then returned.
// If the index is out of bounds, no child is removed and nil is returned.
func (e *Element) RemoveChildAt(index int) Token {
	if index >= len(e.Child) {
		return nil
	}

	t := e.Child[index]
	for j := index + 1; j < len(e.Child); j++ {
		e.Child[j].setIndex(j - 1)
	}
	e.Child = append(e.Child[:index], e.Child[index+1:]...)
	t.setIndex(-1)
	t.setParent(nil)
	return t
}

// autoClose analyzes the stack's top element and the current token to decide
// whether the top element should be closed.
func (e *Element) autoClose(stack *stack[*Element], t xml.Token, tags []string) {
	if stack.empty() {
		return
	}

	top := stack.peek()

	for _, tag := range tags {
		if strings.EqualFold(tag, top.FullTag()) {
			if e, ok := t.(xml.EndElement); !ok ||
				!strings.EqualFold(e.Name.Space, top.Space) ||
				!strings.EqualFold(e.Name.Local, top.Tag) {
				stack.pop()
			}
			break
		}
	}
}

// ReadFrom reads XML from the reader 'ri' and stores the result as a new
// child of this element.
func (e *Element) readFrom(ri io.Reader, settings ReadSettings) (n int64, err error) {
	var r xmlReader
	var pr *xmlPeekReader
	if settings.PreserveCData {
		pr = newXmlPeekReader(ri)
		r = pr
	} else {
		r = newXmlSimpleReader(ri)
	}

	attrCheck := make(map[xml.Name]int)
	dec := newDecoder(r, settings)

	var stack stack[*Element]
	stack.push(e)
	for {
		if pr != nil {
			pr.PeekPrepare(dec.InputOffset(), len(cdataPrefix))
		}

		t, err := dec.RawToken()

		if settings.Permissive && settings.AutoClose != nil {
			e.autoClose(&stack, t, settings.AutoClose)
		}

		switch {
		case err == io.EOF:
			if len(stack.data) != 1 {
				return r.Bytes(), ErrXML
			}
			return r.Bytes(), nil
		case err != nil:
			return r.Bytes(), err
		case stack.empty():
			return r.Bytes(), ErrXML
		}

		top := stack.peek()

		switch t := t.(type) {
		case xml.StartElement:
			e := newElement(t.Name.Space, t.Name.Local, top)
			if settings.PreserveDuplicateAttrs || len(t.Attr) < 2 {
				for _, a := range t.Attr {
					e.addAttr(a.Name.Space, a.Name.Local, a.Value)
				}
			} else {
				for _, a := range t.Attr {
					if i, contains := attrCheck[a.Name]; contains {
						e.Attr[i].Value = a.Value
					} else {
						attrCheck[a.Name] = e.addAttr(a.Name.Space, a.Name.Local, a.Value)
					}
				}
				clear(attrCheck)
			}
			stack.push(e)
		case xml.EndElement:
			if top.Tag != t.Name.Local || top.Space != t.Name.Space {
				return r.Bytes(), ErrXML
			}
			stack.pop()
		case xml.CharData:
			data := string(t)
			var flags charDataFlags
			if pr != nil {
				peekBuf := pr.PeekFinalize()
				if bytes.Equal(peekBuf, cdataPrefix) {
					flags = cdataFlag
				} else if isWhitespace(data) {
					flags = whitespaceFlag
				}
			} else {
				if isWhitespace(data) {
					flags = whitespaceFlag
				}
			}
			newCharData(data, flags, top)
		case xml.Comment:
			newComment(string(t), top)
		case xml.Directive:
			newDirective(string(t), top)
		case xml.ProcInst:
			newProcInst(t.Target, string(t.Inst), top)
		}
	}
}

// SelectAttr finds an element attribute matching the requested 'key' and, if
// found, returns a pointer to the matching attribute. The function returns
// nil if no matching attribute is found. The key may include a namespace
// prefix followed by a colon.
func (e *Element) SelectAttr(key string) *Attr {
	space, skey := spaceDecompose(key)
	for i, a := range e.Attr {
		if spaceMatch(space, a.Space) && skey == a.Key {
			return &e.Attr[i]
		}
	}
	return nil
}

// SelectAttrValue finds an element attribute matching the requested 'key' and
// returns its value if found. If no matching attribute is found, the function
// returns the 'dflt' value instead. The key may include a namespace prefix
// followed by a colon.
func (e *Element) SelectAttrValue(key, dflt string) string {
	space, skey := spaceDecompose(key)
	for _, a := range e.Attr {
		if spaceMatch(space, a.Space) && skey == a.Key {
			return a.Value
		}
	}
	return dflt
}

// ChildElements returns all elements that are children of this element.
func (e *Element) ChildElements() []*Element {
	var elements []*Element
	for _, t := range e.Child {
		if c, ok := t.(*Element); ok {
			elements = append(elements, c)
		}
	}
	return elements
}

// SelectElement returns the first child element with the given 'tag' (i.e.,
// name). The function returns nil if no child element matching the tag is
// found. The tag may include a namespace prefix followed by a colon.
func (e *Element) SelectElement(tag string) *Element {
	space, stag := spaceDecompose(tag)
	for _, t := range e.Child {
		if c, ok := t.(*Element); ok && spaceMatch(space, c.Space) && stag == c.Tag {
			return c
		}
	}
	return nil
}

// SelectElements returns a slice of all child elements with the given 'tag'
// (i.e., name). The tag may include a namespace prefix followed by a colon.
func (e *Element) SelectElements(tag string) []*Element {
	space, stag := spaceDecompose(tag)
	var elements []*Element
	for _, t := range e.Child {
		if c, ok := t.(*Element); ok && spaceMatch(space, c.Space) && stag == c.Tag {
			elements = append(elements, c)
		}
	}
	return elements
}

// FindElement returns the first element matched by the XPath-like 'path'
// string. The function returns nil if no child element is found using the
// path. It panics if an invalid path string is supplied.
func (e *Element) FindElement(path string) *Element {
	return e.FindElementPath(MustCompilePath(path))
}

// FindElementPath returns the first element matched by the 'path' object. The
// function returns nil if no element is found using the path.
func (e *Element) FindElementPath(path Path) *Element {
	p := newPather()
	elements := p.traverse(e, path)
	if len(elements) > 0 {
		return elements[0]
	}
	return nil
}

// FindElements returns a slice of elements matched by the XPath-like 'path'
// string. The function returns nil if no child element is found using the
// path. It panics if an invalid path string is supplied.
func (e *Element) FindElements(path string) []*Element {
	return e.FindElementsPath(MustCompilePath(path))
}

// FindElementsPath returns a slice of elements matched by the 'path' object.
func (e *Element) FindElementsPath(path Path) []*Element {
	p := newPather()
	return p.traverse(e, path)
}

// NotNil returns the receiver element if it isn't nil; otherwise, it returns
// an unparented element with an empty string tag. This function simplifies
// the task of writing code to ignore not-found results from element queries.
// For example, instead of writing this:
//
//	if e := doc.SelectElement("enabled"); e != nil {
//		e.SetText("true")
//	}
//
// You could write this:
//
//	doc.SelectElement("enabled").NotNil().SetText("true")
func (e *Element) NotNil() *Element {
	if e == nil {
		return NewElement("")
	}
	return e
}

// GetPath returns the absolute path of the element. The absolute path is the
// full path from the document's root.
func (e *Element) GetPath() string {
	path := []string{}
	for seg := e; seg != nil; seg = seg.Parent() {
		if seg.Tag != "" {
			path = append(path, seg.Tag)
		}
	}

	// Reverse the path.
	for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
		path[i], path[j] = path[j], path[i]
	}

	return "/" + strings.Join(path, "/")
}

// GetRelativePath returns the path of this element relative to the 'source'
// element. If the two elements are not part of the same element tree, then
// the function returns the empty string.
func (e *Element) GetRelativePath(source *Element) string {
	var path []*Element

	if source == nil {
		return ""
	}

	// Build a reverse path from the element toward the root. Stop if the
	// source element is encountered.
	var seg *Element
	for seg = e; seg != nil && seg != source; seg = seg.Parent() {
		path = append(path, seg)
	}

	// If we found the source element, reverse the path and compose the
	// string.
	if seg == source {
		if len(path) == 0 {
			return "."
		}
		parts := []string{}
		for i := len(path) - 1; i >= 0; i-- {
			parts = append(parts, path[i].Tag)
		}
		return "./" + strings.Join(parts, "/")
	}

	// The source wasn't encountered, so climb from the source element toward
	// the root of the tree until an element in the reversed path is
	// encountered.

	findPathIndex := func(e *Element, path []*Element) int {
		for i, ee := range path {
			if e == ee {
				return i
			}
		}
		return -1
	}

	climb := 0
	for seg = source; seg != nil; seg = seg.Parent() {
		i := findPathIndex(seg, path)
		if i >= 0 {
			path = path[:i] // truncate at found segment
			break
		}
		climb++
	}

	// No element in the reversed path was encountered, so the two elements
	// must not be part of the same tree.
	if seg == nil {
		return ""
	}

	// Reverse the (possibly truncated) path and prepend ".." segments to
	// climb.
	parts := []string{}
	for i := 0; i < climb; i++ {
		parts = append(parts, "..")
	}
	for i := len(path) - 1; i >= 0; i-- {
		parts = append(parts, path[i].Tag)
	}
	return strings.Join(parts, "/")
}

// IndentWithSettings modifies the element and its child tree by inserting
// character data tokens containing newlines and indentation. The behavior of
// the indentation algorithm is configured by the indent settings. Because
// this function indents the element as if it were at the root of a document,
// it is most useful when called just before writing the element as an XML
// fragment using WriteTo.
func (e *Element) IndentWithSettings(s *IndentSettings) {
	e.indent(1, getIndentFunc(s), s)
}

// indent recursively inserts proper indentation between an XML element's
// child tokens.
func (e *Element) indent(depth int, indent indentFunc, s *IndentSettings) {
	e.stripIndent(s)
	n := len(e.Child)
	if n == 0 {
		return
	}

	oldChild := e.Child
	e.Child = make([]Token, 0, n*2+1)
	isCharData, firstNonCharData := false, true
	for _, c := range oldChild {
		// Insert NL+indent before child if it's not character data.
		// Exceptions: when it's the first non-character-data child, or when
		// the child is at root depth.
		_, isCharData = c.(*CharData)
		if !isCharData {
			if !firstNonCharData || depth > 0 {
				s := indent(depth)
				if s != "" {
					newCharData(s, whitespaceFlag, e)
				}
			}
			firstNonCharData = false
		}

		e.addChild(c)

		// Recursively process child elements.
		if ce, ok := c.(*Element); ok {
			ce.indent(depth+1, indent, s)
		}
	}

	// Insert NL+indent before the last child.
	if !isCharData {
		if !firstNonCharData || depth > 0 {
			s := indent(depth - 1)
			if s != "" {
				newCharData(s, whitespaceFlag, e)
			}
		}
	}
}

// stripIndent removes any previously inserted indentation.
func (e *Element) stripIndent(s *IndentSettings) {
	// Count the number of non-indent child tokens
	n := len(e.Child)
	for _, c := range e.Child {
		if cd, ok := c.(*CharData); ok && cd.IsWhitespace() {
			n--
		}
	}
	if n == len(e.Child) {
		return
	}
	if n == 0 && len(e.Child) == 1 && s.PreserveLeafWhitespace {
		return
	}

	// Strip out indent CharData
	newChild := make([]Token, n)
	j := 0
	for _, c := range e.Child {
		if cd, ok := c.(*CharData); ok && cd.IsWhitespace() {
			continue
		}
		newChild[j] = c
		newChild[j].setIndex(j)
		j++
	}
	e.Child = newChild
}

// stripTrailingWhitespace removes any trailing whitespace CharData tokens
// from the element's children.
func (e *Element) stripTrailingWhitespace() {
	for i := len(e.Child) - 1; i >= 0; i-- {
		if cd, ok := e.Child[i].(*CharData); !ok || !cd.IsWhitespace() {
			e.Child = e.Child[:i+1]
			return
		}
	}
}

// dup duplicates the element.
func (e *Element) dup(parent *Element) Token {
	ne := &Element{
		Space:  e.Space,
		Tag:    e.Tag,
		Attr:   make([]Attr, len(e.Attr)),
		Child:  make([]Token, len(e.Child)),
		parent: parent,
		index:  e.index,
	}
	for i, t := range e.Child {
		ne.Child[i] = t.dup(ne)
	}
	copy(ne.Attr, e.Attr)
	return ne
}

// NextSibling returns this element's next sibling element. It returns nil if
// there is no next sibling element.
func (e *Element) NextSibling() *Element {
	if e.parent == nil {
		return nil
	}
	for i := e.index + 1; i < len(e.parent.Child); i++ {
		if s, ok := e.parent.Child[i].(*Element); ok {
			return s
		}
	}
	return nil
}

// PrevSibling returns this element's preceding sibling element. It returns
// nil if there is no preceding sibling element.
func (e *Element) PrevSibling() *Element {
	if e.parent == nil {
		return nil
	}
	for i := e.index - 1; i >= 0; i-- {
		if s, ok := e.parent.Child[i].(*Element); ok {
			return s
		}
	}
	return nil
}

// Parent returns this element's parent element. It returns nil if this
// element has no parent.
func (e *Element) Parent() *Element {
	return e.parent
}

// Index returns the index of this element within its parent element's
// list of child tokens. If this element has no parent, then the function
// returns -1.
func (e *Element) Index() int {
	return e.index
}

// WriteTo serializes the element to the writer w.
func (e *Element) WriteTo(w Writer, s *WriteSettings) {
	w.WriteByte('<')
	w.WriteString(e.FullTag())
	for _, a := range e.Attr {
		w.WriteByte(' ')
		a.WriteTo(w, s)
	}
	if len(e.Child) > 0 {
		w.WriteByte('>')
		for _, c := range e.Child {
			c.WriteTo(w, s)
		}
		w.Write([]byte{'<', '/'})
		w.WriteString(e.FullTag())
		w.WriteByte('>')
	} else {
		if s.CanonicalEndTags {
			w.Write([]byte{'>', '<', '/'})
			w.WriteString(e.FullTag())
			w.WriteByte('>')
		} else {
			w.Write([]byte{'/', '>'})
		}
	}
}

// setParent replaces this element token's parent.
func (e *Element) setParent(parent *Element) {
	e.parent = parent
}

// setIndex sets this element token's index within its parent's Child slice.
func (e *Element) setIndex(index int) {
	e.index = index
}

// addChild adds a child token to the element e.
func (e *Element) addChild(t Token) {
	t.setParent(e)
	t.setIndex(len(e.Child))
	e.Child = append(e.Child, t)
}

// CreateAttr creates an attribute with the specified 'key' and 'value' and
// adds it to this element. If an attribute with same key already exists on
// this element, then its value is replaced. The key may include a namespace
// prefix followed by a colon.
func (e *Element) CreateAttr(key, value string) *Attr {
	space, skey := spaceDecompose(key)

	for i, a := range e.Attr {
		if space == a.Space && skey == a.Key {
			e.Attr[i].Value = value
			return &e.Attr[i]
		}
	}

	i := e.addAttr(space, skey, value)
	return &e.Attr[i]
}

// addAttr is a helper function that adds an attribute to an element. Returns
// the index of the added attribute.
func (e *Element) addAttr(space, key, value string) int {
	a := Attr{
		Space:   space,
		Key:     key,
		Value:   value,
		element: e,
	}
	e.Attr = append(e.Attr, a)
	return len(e.Attr) - 1
}

// RemoveAttr removes the first attribute of this element whose key matches
// 'key'. It returns a copy of the removed attribute if a match is found. If
// no match is found, it returns nil. The key may include a namespace prefix
// followed by a colon.
func (e *Element) RemoveAttr(key string) *Attr {
	space, skey := spaceDecompose(key)
	for i, a := range e.Attr {
		if space == a.Space && skey == a.Key {
			e.Attr = append(e.Attr[0:i], e.Attr[i+1:]...)
			return &Attr{
				Space:   a.Space,
				Key:     a.Key,
				Value:   a.Value,
				element: nil,
			}
		}
	}
	return nil
}

// SortAttrs sorts this element's attributes lexicographically by key.
func (e *Element) SortAttrs() {
	slices.SortFunc(e.Attr, func(a, b Attr) int {
		if v := strings.Compare(a.Space, b.Space); v != 0 {
			return v
		}
		return strings.Compare(a.Key, b.Key)
	})
}

// FullKey returns this attribute's complete key, including namespace prefix
// if present.
func (a *Attr) FullKey() string {
	if a.Space == "" {
		return a.Key
	}
	return a.Space + ":" + a.Key
}

// Element returns a pointer to the element containing this attribute.
func (a *Attr) Element() *Element {
	return a.element
}

// NamespaceURI returns the XML namespace URI associated with this attribute.
// The function returns the empty string if the attribute is unprefixed or
// if the attribute is part of the XML default namespace.
func (a *Attr) NamespaceURI() string {
	if a.Space == "" {
		return ""
	}
	return a.element.findLocalNamespaceURI(a.Space)
}

// WriteTo serializes the attribute to the writer.
func (a *Attr) WriteTo(w Writer, s *WriteSettings) {
	w.WriteString(a.FullKey())
	if s.AttrSingleQuote {
		w.WriteString(`='`)
	} else {
		w.WriteString(`="`)
	}
	var m escapeMode
	if s.CanonicalAttrVal {
		m = escapeCanonicalAttr
	} else {
		m = escapeNormal
	}
	escapeString(w, a.Value, m)
	if s.AttrSingleQuote {
		w.WriteByte('\'')
	} else {
		w.WriteByte('"')
	}
}

// NewText creates an unparented CharData token containing simple text data.
func NewText(text string) *CharData {
	return newCharData(text, 0, nil)
}

// NewCData creates an unparented XML character CDATA section with 'data' as
// its content.
func NewCData(data string) *CharData {
	return newCharData(data, cdataFlag, nil)
}

// NewCharData creates an unparented CharData token containing simple text
// data.
//
// Deprecated: NewCharData is deprecated. Instead, use NewText, which does the
// same thing.
func NewCharData(data string) *CharData {
	return newCharData(data, 0, nil)
}

// newCharData creates a character data token and binds it to a parent
// element. If parent is nil, the CharData token remains unbound.
func newCharData(data string, flags charDataFlags, parent *Element) *CharData {
	c := &CharData{
		Data:   data,
		parent: nil,
		index:  -1,
		flags:  flags,
	}
	if parent != nil {
		parent.addChild(c)
	}
	return c
}

// CreateText creates a CharData token containing simple text data and adds it
// to the end of this element's list of child tokens.
func (e *Element) CreateText(text string) *CharData {
	return newCharData(text, 0, e)
}

// CreateCData creates a CharData token containing a CDATA section with 'data'
// as its content and adds it to the end of this element's list of child
// tokens.
func (e *Element) CreateCData(data string) *CharData {
	return newCharData(data, cdataFlag, e)
}

// CreateCharData creates a CharData token containing simple text data and
// adds it to the end of this element's list of child tokens.
//
// Deprecated: CreateCharData is deprecated. Instead, use CreateText, which
// does the same thing.
func (e *Element) CreateCharData(data string) *CharData {
	return e.CreateText(data)
}

// SetData modifies the content of the CharData token. In the case of a
// CharData token containing simple text, the simple text is modified. In the
// case of a CharData token containing a CDATA section, the CDATA section's
// content is modified.
func (c *CharData) SetData(text string) {
	c.Data = text
	if isWhitespace(text) {
		c.flags |= whitespaceFlag
	} else {
		c.flags &= ^whitespaceFlag
	}
}

// IsCData returns true if this CharData token is contains a CDATA section. It
// returns false if the CharData token contains simple text.
func (c *CharData) IsCData() bool {
	return (c.flags & cdataFlag) != 0
}

// IsWhitespace returns true if this CharData token contains only whitespace.
func (c *CharData) IsWhitespace() bool {
	return (c.flags & whitespaceFlag) != 0
}

// Parent returns this CharData token's parent element, or nil if it has no
// parent.
func (c *CharData) Parent() *Element {
	return c.parent
}

// Index returns the index of this CharData token within its parent element's
// list of child tokens. If this CharData token has no parent, then the
// function returns -1.
func (c *CharData) Index() int {
	return c.index
}

// WriteTo serializes character data to the writer.
func (c *CharData) WriteTo(w Writer, s *WriteSettings) {
	if c.IsCData() {
		w.WriteString(`<![CDATA[`)
		w.WriteString(c.Data)
		w.WriteString(`]]>`)
	} else {
		var m escapeMode
		if s.CanonicalText {
			m = escapeCanonicalText
		} else {
			m = escapeNormal
		}
		escapeString(w, c.Data, m)
	}
}

// dup duplicates the character data.
func (c *CharData) dup(parent *Element) Token {
	return &CharData{
		Data:   c.Data,
		flags:  c.flags,
		parent: parent,
		index:  c.index,
	}
}

// setParent replaces the character data token's parent.
func (c *CharData) setParent(parent *Element) {
	c.parent = parent
}

// setIndex sets the CharData token's index within its parent element's Child
// slice.
func (c *CharData) setIndex(index int) {
	c.index = index
}

// NewComment creates an unparented comment token.
func NewComment(comment string) *Comment {
	return newComment(comment, nil)
}

// NewComment creates a comment token and sets its parent element to 'parent'.
func newComment(comment string, parent *Element) *Comment {
	c := &Comment{
		Data:   comment,
		parent: nil,
		index:  -1,
	}
	if parent != nil {
		parent.addChild(c)
	}
	return c
}

// CreateComment creates a comment token using the specified 'comment' string
// and adds it as the last child token of this element.
func (e *Element) CreateComment(comment string) *Comment {
	return newComment(comment, e)
}

// dup duplicates the comment.
func (c *Comment) dup(parent *Element) Token {
	return &Comment{
		Data:   c.Data,
		parent: parent,
		index:  c.index,
	}
}

// Parent returns comment token's parent element, or nil if it has no parent.
func (c *Comment) Parent() *Element {
	return c.parent
}

// Index returns the index of this Comment token within its parent element's
// list of child tokens. If this Comment token has no parent, then the
// function returns -1.
func (c *Comment) Index() int {
	return c.index
}

// WriteTo serialies the comment to the writer.
func (c *Comment) WriteTo(w Writer, s *WriteSettings) {
	w.WriteString("<!--")
	w.WriteString(c.Data)
	w.WriteString("-->")
}

// setParent replaces the comment token's parent.
func (c *Comment) setParent(parent *Element) {
	c.parent = parent
}

// setIndex sets the Comment token's index within its parent element's Child
// slice.
func (c *Comment) setIndex(index int) {
	c.index = index
}

// NewDirective creates an unparented XML directive token.
func NewDirective(data string) *Directive {
	return newDirective(data, nil)
}

// newDirective creates an XML directive and binds it to a parent element. If
// parent is nil, the Directive remains unbound.
func newDirective(data string, parent *Element) *Directive {
	d := &Directive{
		Data:   data,
		parent: nil,
		index:  -1,
	}
	if parent != nil {
		parent.addChild(d)
	}
	return d
}

// CreateDirective creates an XML directive token with the specified 'data'
// value and adds it as the last child token of this element.
func (e *Element) CreateDirective(data string) *Directive {
	return newDirective(data, e)
}

// dup duplicates the directive.
func (d *Directive) dup(parent *Element) Token {
	return &Directive{
		Data:   d.Data,
		parent: parent,
		index:  d.index,
	}
}

// Parent returns directive token's parent element, or nil if it has no
// parent.
func (d *Directive) Parent() *Element {
	return d.parent
}

// Index returns the index of this Directive token within its parent element's
// list of child tokens. If this Directive token has no parent, then the
// function returns -1.
func (d *Directive) Index() int {
	return d.index
}

// WriteTo serializes the XML directive to the writer.
func (d *Directive) WriteTo(w Writer, s *WriteSettings) {
	w.WriteString("<!")
	w.WriteString(d.Data)
	w.WriteString(">")
}

// setParent replaces the directive token's parent.
func (d *Directive) setParent(parent *Element) {
	d.parent = parent
}

// setIndex sets the Directive token's index within its parent element's Child
// slice.
func (d *Directive) setIndex(index int) {
	d.index = index
}

// NewProcInst creates an unparented XML processing instruction.
func NewProcInst(target, inst string) *ProcInst {
	return newProcInst(target, inst, nil)
}

// newProcInst creates an XML processing instruction and binds it to a parent
// element. If parent is nil, the ProcInst remains unbound.
func newProcInst(target, inst string, parent *Element) *ProcInst {
	p := &ProcInst{
		Target: target,
		Inst:   inst,
		parent: nil,
		index:  -1,
	}
	if parent != nil {
		parent.addChild(p)
	}
	return p
}

// CreateProcInst creates an XML processing instruction token with the
// specified 'target' and instruction 'inst'. It is then added as the last
// child token of this element.
func (e *Element) CreateProcInst(target, inst string) *ProcInst {
	return newProcInst(target, inst, e)
}

// dup duplicates the procinst.
func (p *ProcInst) dup(parent *Element) Token {
	return &ProcInst{
		Target: p.Target,
		Inst:   p.Inst,
		parent: parent,
		index:  p.index,
	}
}

// Parent returns processing instruction token's parent element, or nil if it
// has no parent.
func (p *ProcInst) Parent() *Element {
	return p.parent
}

// Index returns the index of this ProcInst token within its parent element's
// list of child tokens. If this ProcInst token has no parent, then the
// function returns -1.
func (p *ProcInst) Index() int {
	return p.index
}

// WriteTo serializes the processing instruction to the writer.
func (p *ProcInst) WriteTo(w Writer, s *WriteSettings) {
	w.WriteString("<?")
	w.WriteString(p.Target)
	if p.Inst != "" {
		w.WriteByte(' ')
		w.WriteString(p.Inst)
	}
	w.WriteString("?>")
}

// setParent replaces the processing instruction token's parent.
func (p *ProcInst) setParent(parent *Element) {
	p.parent = parent
}

// setIndex sets the processing instruction token's index within its parent
// element's Child slice.
func (p *ProcInst) setIndex(index int) {
	p.index = index
}
