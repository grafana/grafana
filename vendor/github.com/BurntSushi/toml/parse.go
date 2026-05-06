package toml

import (
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/BurntSushi/toml/internal"
)

type parser struct {
	lx         *lexer
	context    Key      // Full key for the current hash in scope.
	currentKey string   // Base key name for everything except hashes.
	pos        Position // Current position in the TOML file.
	tomlNext   bool

	ordered []Key // List of keys in the order that they appear in the TOML data.

	keyInfo   map[string]keyInfo  // Map keyname → info about the TOML key.
	mapping   map[string]any      // Map keyname → key value.
	implicits map[string]struct{} // Record implicit keys (e.g. "key.group.names").
}

type keyInfo struct {
	pos      Position
	tomlType tomlType
}

func parse(data string) (p *parser, err error) {
	_, tomlNext := os.LookupEnv("BURNTSUSHI_TOML_110")

	defer func() {
		if r := recover(); r != nil {
			if pErr, ok := r.(ParseError); ok {
				pErr.input = data
				err = pErr
				return
			}
			panic(r)
		}
	}()

	// Read over BOM; do this here as the lexer calls utf8.DecodeRuneInString()
	// which mangles stuff. UTF-16 BOM isn't strictly valid, but some tools add
	// it anyway.
	if strings.HasPrefix(data, "\xff\xfe") || strings.HasPrefix(data, "\xfe\xff") { // UTF-16
		data = data[2:]
	} else if strings.HasPrefix(data, "\xef\xbb\xbf") { // UTF-8
		data = data[3:]
	}

	// Examine first few bytes for NULL bytes; this probably means it's a UTF-16
	// file (second byte in surrogate pair being NULL). Again, do this here to
	// avoid having to deal with UTF-8/16 stuff in the lexer.
	ex := 6
	if len(data) < 6 {
		ex = len(data)
	}
	if i := strings.IndexRune(data[:ex], 0); i > -1 {
		return nil, ParseError{
			Message:  "files cannot contain NULL bytes; probably using UTF-16; TOML files must be UTF-8",
			Position: Position{Line: 1, Col: 1, Start: i, Len: 1},
			Line:     1,
			input:    data,
		}
	}

	p = &parser{
		keyInfo:   make(map[string]keyInfo),
		mapping:   make(map[string]any),
		lx:        lex(data, tomlNext),
		ordered:   make([]Key, 0),
		implicits: make(map[string]struct{}),
		tomlNext:  tomlNext,
	}
	for {
		item := p.next()
		if item.typ == itemEOF {
			break
		}
		p.topLevel(item)
	}

	return p, nil
}

func (p *parser) panicErr(it item, err error) {
	panic(ParseError{
		Message:  err.Error(),
		err:      err,
		Position: it.pos.withCol(p.lx.input),
		Line:     it.pos.Len,
		LastKey:  p.current(),
	})
}

func (p *parser) panicItemf(it item, format string, v ...any) {
	panic(ParseError{
		Message:  fmt.Sprintf(format, v...),
		Position: it.pos.withCol(p.lx.input),
		Line:     it.pos.Len,
		LastKey:  p.current(),
	})
}

func (p *parser) panicf(format string, v ...any) {
	panic(ParseError{
		Message:  fmt.Sprintf(format, v...),
		Position: p.pos.withCol(p.lx.input),
		Line:     p.pos.Line,
		LastKey:  p.current(),
	})
}

func (p *parser) next() item {
	it := p.lx.nextItem()
	//fmt.Printf("ITEM %-18s line %-3d │ %q\n", it.typ, it.pos.Line, it.val)
	if it.typ == itemError {
		if it.err != nil {
			panic(ParseError{
				Message:  it.err.Error(),
				err:      it.err,
				Position: it.pos.withCol(p.lx.input),
				Line:     it.pos.Line,
				LastKey:  p.current(),
			})
		}

		p.panicItemf(it, "%s", it.val)
	}
	return it
}

func (p *parser) nextPos() item {
	it := p.next()
	p.pos = it.pos
	return it
}

func (p *parser) bug(format string, v ...any) {
	panic(fmt.Sprintf("BUG: "+format+"\n\n", v...))
}

func (p *parser) expect(typ itemType) item {
	it := p.next()
	p.assertEqual(typ, it.typ)
	return it
}

func (p *parser) assertEqual(expected, got itemType) {
	if expected != got {
		p.bug("Expected '%s' but got '%s'.", expected, got)
	}
}

func (p *parser) topLevel(item item) {
	switch item.typ {
	case itemCommentStart: // # ..
		p.expect(itemText)
	case itemTableStart: // [ .. ]
		name := p.nextPos()

		var key Key
		for ; name.typ != itemTableEnd && name.typ != itemEOF; name = p.next() {
			key = append(key, p.keyString(name))
		}
		p.assertEqual(itemTableEnd, name.typ)

		p.addContext(key, false)
		p.setType("", tomlHash, item.pos)
		p.ordered = append(p.ordered, key)
	case itemArrayTableStart: // [[ .. ]]
		name := p.nextPos()

		var key Key
		for ; name.typ != itemArrayTableEnd && name.typ != itemEOF; name = p.next() {
			key = append(key, p.keyString(name))
		}
		p.assertEqual(itemArrayTableEnd, name.typ)

		p.addContext(key, true)
		p.setType("", tomlArrayHash, item.pos)
		p.ordered = append(p.ordered, key)
	case itemKeyStart: // key = ..
		outerContext := p.context
		/// Read all the key parts (e.g. 'a' and 'b' in 'a.b')
		k := p.nextPos()
		var key Key
		for ; k.typ != itemKeyEnd && k.typ != itemEOF; k = p.next() {
			key = append(key, p.keyString(k))
		}
		p.assertEqual(itemKeyEnd, k.typ)

		/// The current key is the last part.
		p.currentKey = key.last()

		/// All the other parts (if any) are the context; need to set each part
		/// as implicit.
		context := key.parent()
		for i := range context {
			p.addImplicitContext(append(p.context, context[i:i+1]...))
		}
		p.ordered = append(p.ordered, p.context.add(p.currentKey))

		/// Set value.
		vItem := p.next()
		val, typ := p.value(vItem, false)
		p.setValue(p.currentKey, val)
		p.setType(p.currentKey, typ, vItem.pos)

		/// Remove the context we added (preserving any context from [tbl] lines).
		p.context = outerContext
		p.currentKey = ""
	default:
		p.bug("Unexpected type at top level: %s", item.typ)
	}
}

// Gets a string for a key (or part of a key in a table name).
func (p *parser) keyString(it item) string {
	switch it.typ {
	case itemText:
		return it.val
	case itemString, itemStringEsc, itemMultilineString,
		itemRawString, itemRawMultilineString:
		s, _ := p.value(it, false)
		return s.(string)
	default:
		p.bug("Unexpected key type: %s", it.typ)
	}
	panic("unreachable")
}

var datetimeRepl = strings.NewReplacer(
	"z", "Z",
	"t", "T",
	" ", "T")

// value translates an expected value from the lexer into a Go value wrapped
// as an empty interface.
func (p *parser) value(it item, parentIsArray bool) (any, tomlType) {
	switch it.typ {
	case itemString:
		return it.val, p.typeOfPrimitive(it)
	case itemStringEsc:
		return p.replaceEscapes(it, it.val), p.typeOfPrimitive(it)
	case itemMultilineString:
		return p.replaceEscapes(it, p.stripEscapedNewlines(stripFirstNewline(it.val))), p.typeOfPrimitive(it)
	case itemRawString:
		return it.val, p.typeOfPrimitive(it)
	case itemRawMultilineString:
		return stripFirstNewline(it.val), p.typeOfPrimitive(it)
	case itemInteger:
		return p.valueInteger(it)
	case itemFloat:
		return p.valueFloat(it)
	case itemBool:
		switch it.val {
		case "true":
			return true, p.typeOfPrimitive(it)
		case "false":
			return false, p.typeOfPrimitive(it)
		default:
			p.bug("Expected boolean value, but got '%s'.", it.val)
		}
	case itemDatetime:
		return p.valueDatetime(it)
	case itemArray:
		return p.valueArray(it)
	case itemInlineTableStart:
		return p.valueInlineTable(it, parentIsArray)
	default:
		p.bug("Unexpected value type: %s", it.typ)
	}
	panic("unreachable")
}

func (p *parser) valueInteger(it item) (any, tomlType) {
	if !numUnderscoresOK(it.val) {
		p.panicItemf(it, "Invalid integer %q: underscores must be surrounded by digits", it.val)
	}
	if numHasLeadingZero(it.val) {
		p.panicItemf(it, "Invalid integer %q: cannot have leading zeroes", it.val)
	}

	num, err := strconv.ParseInt(it.val, 0, 64)
	if err != nil {
		// Distinguish integer values. Normally, it'd be a bug if the lexer
		// provides an invalid integer, but it's possible that the number is
		// out of range of valid values (which the lexer cannot determine).
		// So mark the former as a bug but the latter as a legitimate user
		// error.
		if e, ok := err.(*strconv.NumError); ok && e.Err == strconv.ErrRange {
			p.panicErr(it, errParseRange{i: it.val, size: "int64"})
		} else {
			p.bug("Expected integer value, but got '%s'.", it.val)
		}
	}
	return num, p.typeOfPrimitive(it)
}

func (p *parser) valueFloat(it item) (any, tomlType) {
	parts := strings.FieldsFunc(it.val, func(r rune) bool {
		switch r {
		case '.', 'e', 'E':
			return true
		}
		return false
	})
	for _, part := range parts {
		if !numUnderscoresOK(part) {
			p.panicItemf(it, "Invalid float %q: underscores must be surrounded by digits", it.val)
		}
	}
	if len(parts) > 0 && numHasLeadingZero(parts[0]) {
		p.panicItemf(it, "Invalid float %q: cannot have leading zeroes", it.val)
	}
	if !numPeriodsOK(it.val) {
		// As a special case, numbers like '123.' or '1.e2',
		// which are valid as far as Go/strconv are concerned,
		// must be rejected because TOML says that a fractional
		// part consists of '.' followed by 1+ digits.
		p.panicItemf(it, "Invalid float %q: '.' must be followed by one or more digits", it.val)
	}
	val := strings.Replace(it.val, "_", "", -1)
	signbit := false
	if val == "+nan" || val == "-nan" {
		signbit = val == "-nan"
		val = "nan"
	}
	num, err := strconv.ParseFloat(val, 64)
	if err != nil {
		if e, ok := err.(*strconv.NumError); ok && e.Err == strconv.ErrRange {
			p.panicErr(it, errParseRange{i: it.val, size: "float64"})
		} else {
			p.panicItemf(it, "Invalid float value: %q", it.val)
		}
	}
	if signbit {
		num = math.Copysign(num, -1)
	}
	return num, p.typeOfPrimitive(it)
}

var dtTypes = []struct {
	fmt  string
	zone *time.Location
	next bool
}{
	{time.RFC3339Nano, time.Local, false},
	{"2006-01-02T15:04:05.999999999", internal.LocalDatetime, false},
	{"2006-01-02", internal.LocalDate, false},
	{"15:04:05.999999999", internal.LocalTime, false},

	// tomlNext
	{"2006-01-02T15:04Z07:00", time.Local, true},
	{"2006-01-02T15:04", internal.LocalDatetime, true},
	{"15:04", internal.LocalTime, true},
}

func (p *parser) valueDatetime(it item) (any, tomlType) {
	it.val = datetimeRepl.Replace(it.val)
	var (
		t   time.Time
		ok  bool
		err error
	)
	for _, dt := range dtTypes {
		if dt.next && !p.tomlNext {
			continue
		}
		t, err = time.ParseInLocation(dt.fmt, it.val, dt.zone)
		if err == nil {
			if missingLeadingZero(it.val, dt.fmt) {
				p.panicErr(it, errParseDate{it.val})
			}
			ok = true
			break
		}
	}
	if !ok {
		p.panicErr(it, errParseDate{it.val})
	}
	return t, p.typeOfPrimitive(it)
}

// Go's time.Parse() will accept numbers without a leading zero; there isn't any
// way to require it. https://github.com/golang/go/issues/29911
//
// Depend on the fact that the separators (- and :) should always be at the same
// location.
func missingLeadingZero(d, l string) bool {
	for i, c := range []byte(l) {
		if c == '.' || c == 'Z' {
			return false
		}
		if (c < '0' || c > '9') && d[i] != c {
			return true
		}
	}
	return false
}

func (p *parser) valueArray(it item) (any, tomlType) {
	p.setType(p.currentKey, tomlArray, it.pos)

	var (
		// Initialize to a non-nil slice to make it consistent with how S = []
		// decodes into a non-nil slice inside something like struct { S
		// []string }. See #338
		array = make([]any, 0, 2)
	)
	for it = p.next(); it.typ != itemArrayEnd; it = p.next() {
		if it.typ == itemCommentStart {
			p.expect(itemText)
			continue
		}

		val, typ := p.value(it, true)
		array = append(array, val)

		// XXX: type isn't used here, we need it to record the accurate type
		// information.
		//
		// Not entirely sure how to best store this; could use "key[0]",
		// "key[1]" notation, or maybe store it on the Array type?
		_ = typ
	}
	return array, tomlArray
}

func (p *parser) valueInlineTable(it item, parentIsArray bool) (any, tomlType) {
	var (
		topHash      = make(map[string]any)
		outerContext = p.context
		outerKey     = p.currentKey
	)

	p.context = append(p.context, p.currentKey)
	prevContext := p.context
	p.currentKey = ""

	p.addImplicit(p.context)
	p.addContext(p.context, parentIsArray)

	/// Loop over all table key/value pairs.
	for it := p.next(); it.typ != itemInlineTableEnd; it = p.next() {
		if it.typ == itemCommentStart {
			p.expect(itemText)
			continue
		}

		/// Read all key parts.
		k := p.nextPos()
		var key Key
		for ; k.typ != itemKeyEnd && k.typ != itemEOF; k = p.next() {
			key = append(key, p.keyString(k))
		}
		p.assertEqual(itemKeyEnd, k.typ)

		/// The current key is the last part.
		p.currentKey = key.last()

		/// All the other parts (if any) are the context; need to set each part
		/// as implicit.
		context := key.parent()
		for i := range context {
			p.addImplicitContext(append(p.context, context[i:i+1]...))
		}
		p.ordered = append(p.ordered, p.context.add(p.currentKey))

		/// Set the value.
		val, typ := p.value(p.next(), false)
		p.setValue(p.currentKey, val)
		p.setType(p.currentKey, typ, it.pos)

		hash := topHash
		for _, c := range context {
			h, ok := hash[c]
			if !ok {
				h = make(map[string]any)
				hash[c] = h
			}
			hash, ok = h.(map[string]any)
			if !ok {
				p.panicf("%q is not a table", p.context)
			}
		}
		hash[p.currentKey] = val

		/// Restore context.
		p.context = prevContext
	}
	p.context = outerContext
	p.currentKey = outerKey
	return topHash, tomlHash
}

// numHasLeadingZero checks if this number has leading zeroes, allowing for '0',
// +/- signs, and base prefixes.
func numHasLeadingZero(s string) bool {
	if len(s) > 1 && s[0] == '0' && !(s[1] == 'b' || s[1] == 'o' || s[1] == 'x') { // Allow 0b, 0o, 0x
		return true
	}
	if len(s) > 2 && (s[0] == '-' || s[0] == '+') && s[1] == '0' {
		return true
	}
	return false
}

// numUnderscoresOK checks whether each underscore in s is surrounded by
// characters that are not underscores.
func numUnderscoresOK(s string) bool {
	switch s {
	case "nan", "+nan", "-nan", "inf", "-inf", "+inf":
		return true
	}
	accept := false
	for _, r := range s {
		if r == '_' {
			if !accept {
				return false
			}
		}

		// isHex is a superset of all the permissible characters surrounding an
		// underscore.
		accept = isHex(r)
	}
	return accept
}

// numPeriodsOK checks whether every period in s is followed by a digit.
func numPeriodsOK(s string) bool {
	period := false
	for _, r := range s {
		if period && !isDigit(r) {
			return false
		}
		period = r == '.'
	}
	return !period
}

// Set the current context of the parser, where the context is either a hash or
// an array of hashes, depending on the value of the `array` parameter.
//
// Establishing the context also makes sure that the key isn't a duplicate, and
// will create implicit hashes automatically.
func (p *parser) addContext(key Key, array bool) {
	/// Always start at the top level and drill down for our context.
	hashContext := p.mapping
	keyContext := make(Key, 0, len(key)-1)

	/// We only need implicit hashes for the parents.
	for _, k := range key.parent() {
		_, ok := hashContext[k]
		keyContext = append(keyContext, k)

		// No key? Make an implicit hash and move on.
		if !ok {
			p.addImplicit(keyContext)
			hashContext[k] = make(map[string]any)
		}

		// If the hash context is actually an array of tables, then set
		// the hash context to the last element in that array.
		//
		// Otherwise, it better be a table, since this MUST be a key group (by
		// virtue of it not being the last element in a key).
		switch t := hashContext[k].(type) {
		case []map[string]any:
			hashContext = t[len(t)-1]
		case map[string]any:
			hashContext = t
		default:
			p.panicf("Key '%s' was already created as a hash.", keyContext)
		}
	}

	p.context = keyContext
	if array {
		// If this is the first element for this array, then allocate a new
		// list of tables for it.
		k := key.last()
		if _, ok := hashContext[k]; !ok {
			hashContext[k] = make([]map[string]any, 0, 4)
		}

		// Add a new table. But make sure the key hasn't already been used
		// for something else.
		if hash, ok := hashContext[k].([]map[string]any); ok {
			hashContext[k] = append(hash, make(map[string]any))
		} else {
			p.panicf("Key '%s' was already created and cannot be used as an array.", key)
		}
	} else {
		p.setValue(key.last(), make(map[string]any))
	}
	p.context = append(p.context, key.last())
}

// setValue sets the given key to the given value in the current context.
// It will make sure that the key hasn't already been defined, account for
// implicit key groups.
func (p *parser) setValue(key string, value any) {
	var (
		tmpHash    any
		ok         bool
		hash       = p.mapping
		keyContext = make(Key, 0, len(p.context)+1)
	)
	for _, k := range p.context {
		keyContext = append(keyContext, k)
		if tmpHash, ok = hash[k]; !ok {
			p.bug("Context for key '%s' has not been established.", keyContext)
		}
		switch t := tmpHash.(type) {
		case []map[string]any:
			// The context is a table of hashes. Pick the most recent table
			// defined as the current hash.
			hash = t[len(t)-1]
		case map[string]any:
			hash = t
		default:
			p.panicf("Key '%s' has already been defined.", keyContext)
		}
	}
	keyContext = append(keyContext, key)

	if _, ok := hash[key]; ok {
		// Normally redefining keys isn't allowed, but the key could have been
		// defined implicitly and it's allowed to be redefined concretely. (See
		// the `valid/implicit-and-explicit-after.toml` in toml-test)
		//
		// But we have to make sure to stop marking it as an implicit. (So that
		// another redefinition provokes an error.)
		//
		// Note that since it has already been defined (as a hash), we don't
		// want to overwrite it. So our business is done.
		if p.isArray(keyContext) {
			p.removeImplicit(keyContext)
			hash[key] = value
			return
		}
		if p.isImplicit(keyContext) {
			p.removeImplicit(keyContext)
			return
		}
		// Otherwise, we have a concrete key trying to override a previous key,
		// which is *always* wrong.
		p.panicf("Key '%s' has already been defined.", keyContext)
	}

	hash[key] = value
}

// setType sets the type of a particular value at a given key. It should be
// called immediately AFTER setValue.
//
// Note that if `key` is empty, then the type given will be applied to the
// current context (which is either a table or an array of tables).
func (p *parser) setType(key string, typ tomlType, pos Position) {
	keyContext := make(Key, 0, len(p.context)+1)
	keyContext = append(keyContext, p.context...)
	if len(key) > 0 { // allow type setting for hashes
		keyContext = append(keyContext, key)
	}
	// Special case to make empty keys ("" = 1) work.
	// Without it it will set "" rather than `""`.
	// TODO: why is this needed? And why is this only needed here?
	if len(keyContext) == 0 {
		keyContext = Key{""}
	}
	p.keyInfo[keyContext.String()] = keyInfo{tomlType: typ, pos: pos}
}

// Implicit keys need to be created when tables are implied in "a.b.c.d = 1" and
// "[a.b.c]" (the "a", "b", and "c" hashes are never created explicitly).
func (p *parser) addImplicit(key Key)        { p.implicits[key.String()] = struct{}{} }
func (p *parser) removeImplicit(key Key)     { delete(p.implicits, key.String()) }
func (p *parser) isImplicit(key Key) bool    { _, ok := p.implicits[key.String()]; return ok }
func (p *parser) isArray(key Key) bool       { return p.keyInfo[key.String()].tomlType == tomlArray }
func (p *parser) addImplicitContext(key Key) { p.addImplicit(key); p.addContext(key, false) }

// current returns the full key name of the current context.
func (p *parser) current() string {
	if len(p.currentKey) == 0 {
		return p.context.String()
	}
	if len(p.context) == 0 {
		return p.currentKey
	}
	return fmt.Sprintf("%s.%s", p.context, p.currentKey)
}

func stripFirstNewline(s string) string {
	if len(s) > 0 && s[0] == '\n' {
		return s[1:]
	}
	if len(s) > 1 && s[0] == '\r' && s[1] == '\n' {
		return s[2:]
	}
	return s
}

// stripEscapedNewlines removes whitespace after line-ending backslashes in
// multiline strings.
//
// A line-ending backslash is an unescaped \ followed only by whitespace until
// the next newline. After a line-ending backslash, all whitespace is removed
// until the next non-whitespace character.
func (p *parser) stripEscapedNewlines(s string) string {
	var (
		b strings.Builder
		i int
	)
	b.Grow(len(s))
	for {
		ix := strings.Index(s[i:], `\`)
		if ix < 0 {
			b.WriteString(s)
			return b.String()
		}
		i += ix

		if len(s) > i+1 && s[i+1] == '\\' {
			// Escaped backslash.
			i += 2
			continue
		}
		// Scan until the next non-whitespace.
		j := i + 1
	whitespaceLoop:
		for ; j < len(s); j++ {
			switch s[j] {
			case ' ', '\t', '\r', '\n':
			default:
				break whitespaceLoop
			}
		}
		if j == i+1 {
			// Not a whitespace escape.
			i++
			continue
		}
		if !strings.Contains(s[i:j], "\n") {
			// This is not a line-ending backslash. (It's a bad escape sequence,
			// but we can let replaceEscapes catch it.)
			i++
			continue
		}
		b.WriteString(s[:i])
		s = s[j:]
		i = 0
	}
}

func (p *parser) replaceEscapes(it item, str string) string {
	var (
		b    strings.Builder
		skip = 0
	)
	b.Grow(len(str))
	for i, c := range str {
		if skip > 0 {
			skip--
			continue
		}
		if c != '\\' {
			b.WriteRune(c)
			continue
		}

		if i >= len(str) {
			p.bug("Escape sequence at end of string.")
			return ""
		}
		switch str[i+1] {
		default:
			p.bug("Expected valid escape code after \\, but got %q.", str[i+1])
		case ' ', '\t':
			p.panicItemf(it, "invalid escape: '\\%c'", str[i+1])
		case 'b':
			b.WriteByte(0x08)
			skip = 1
		case 't':
			b.WriteByte(0x09)
			skip = 1
		case 'n':
			b.WriteByte(0x0a)
			skip = 1
		case 'f':
			b.WriteByte(0x0c)
			skip = 1
		case 'r':
			b.WriteByte(0x0d)
			skip = 1
		case 'e':
			if p.tomlNext {
				b.WriteByte(0x1b)
				skip = 1
			}
		case '"':
			b.WriteByte(0x22)
			skip = 1
		case '\\':
			b.WriteByte(0x5c)
			skip = 1
		// The lexer guarantees the correct number of characters are present;
		// don't need to check here.
		case 'x':
			if p.tomlNext {
				escaped := p.asciiEscapeToUnicode(it, str[i+2:i+4])
				b.WriteRune(escaped)
				skip = 3
			}
		case 'u':
			escaped := p.asciiEscapeToUnicode(it, str[i+2:i+6])
			b.WriteRune(escaped)
			skip = 5
		case 'U':
			escaped := p.asciiEscapeToUnicode(it, str[i+2:i+10])
			b.WriteRune(escaped)
			skip = 9
		}
	}
	return b.String()
}

func (p *parser) asciiEscapeToUnicode(it item, s string) rune {
	hex, err := strconv.ParseUint(strings.ToLower(s), 16, 32)
	if err != nil {
		p.bug("Could not parse '%s' as a hexadecimal number, but the lexer claims it's OK: %s", s, err)
	}
	if !utf8.ValidRune(rune(hex)) {
		p.panicItemf(it, "Escaped character '\\u%s' is not valid UTF-8.", s)
	}
	return rune(hex)
}
