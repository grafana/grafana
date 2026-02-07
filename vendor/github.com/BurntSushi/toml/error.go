package toml

import (
	"fmt"
	"strings"
)

// ParseError is returned when there is an error parsing the TOML syntax such as
// invalid syntax, duplicate keys, etc.
//
// In addition to the error message itself, you can also print detailed location
// information with context by using [ErrorWithPosition]:
//
//	toml: error: Key 'fruit' was already created and cannot be used as an array.
//
//	At line 4, column 2-7:
//
//	      2 | fruit = []
//	      3 |
//	      4 | [[fruit]] # Not allowed
//	            ^^^^^
//
// [ErrorWithUsage] can be used to print the above with some more detailed usage
// guidance:
//
//	toml: error: newlines not allowed within inline tables
//
//	At line 1, column 18:
//
//	      1 | x = [{ key = 42 #
//	                           ^
//
//	Error help:
//
//	  Inline tables must always be on a single line:
//
//	      table = {key = 42, second = 43}
//
//	  It is invalid to split them over multiple lines like so:
//
//	      # INVALID
//	      table = {
//	          key    = 42,
//	          second = 43
//	      }
//
//	  Use regular for this:
//
//	      [table]
//	      key    = 42
//	      second = 43
type ParseError struct {
	Message  string   // Short technical message.
	Usage    string   // Longer message with usage guidance; may be blank.
	Position Position // Position of the error
	LastKey  string   // Last parsed key, may be blank.

	// Line the error occurred.
	//
	// Deprecated: use [Position].
	Line int

	err   error
	input string
}

// Position of an error.
type Position struct {
	Line  int // Line number, starting at 1.
	Col   int // Error column, starting at 1.
	Start int // Start of error, as byte offset starting at 0.
	Len   int // Length of the error in bytes.
}

func (p Position) withCol(tomlFile string) Position {
	var (
		pos   int
		lines = strings.Split(tomlFile, "\n")
	)
	for i := range lines {
		ll := len(lines[i]) + 1 // +1 for the removed newline
		if pos+ll >= p.Start {
			p.Col = p.Start - pos + 1
			if p.Col < 1 { // Should never happen, but just in case.
				p.Col = 1
			}
			break
		}
		pos += ll
	}
	return p
}

func (pe ParseError) Error() string {
	if pe.LastKey == "" {
		return fmt.Sprintf("toml: line %d: %s", pe.Position.Line, pe.Message)
	}
	return fmt.Sprintf("toml: line %d (last key %q): %s",
		pe.Position.Line, pe.LastKey, pe.Message)
}

// ErrorWithPosition returns the error with detailed location context.
//
// See the documentation on [ParseError].
func (pe ParseError) ErrorWithPosition() string {
	if pe.input == "" { // Should never happen, but just in case.
		return pe.Error()
	}

	// TODO: don't show control characters as literals? This may not show up
	// well everywhere.

	var (
		lines = strings.Split(pe.input, "\n")
		b     = new(strings.Builder)
	)
	if pe.Position.Len == 1 {
		fmt.Fprintf(b, "toml: error: %s\n\nAt line %d, column %d:\n\n",
			pe.Message, pe.Position.Line, pe.Position.Col)
	} else {
		fmt.Fprintf(b, "toml: error: %s\n\nAt line %d, column %d-%d:\n\n",
			pe.Message, pe.Position.Line, pe.Position.Col, pe.Position.Col+pe.Position.Len-1)
	}
	if pe.Position.Line > 2 {
		fmt.Fprintf(b, "% 7d | %s\n", pe.Position.Line-2, expandTab(lines[pe.Position.Line-3]))
	}
	if pe.Position.Line > 1 {
		fmt.Fprintf(b, "% 7d | %s\n", pe.Position.Line-1, expandTab(lines[pe.Position.Line-2]))
	}

	/// Expand tabs, so that the ^^^s are at the correct position, but leave
	/// "column 10-13" intact. Adjusting this to the visual column would be
	/// better, but we don't know the tabsize of the user in their editor, which
	/// can be 8, 4, 2, or something else. We can't know. So leaving it as the
	/// character index is probably the "most correct".
	expanded := expandTab(lines[pe.Position.Line-1])
	diff := len(expanded) - len(lines[pe.Position.Line-1])

	fmt.Fprintf(b, "% 7d | %s\n", pe.Position.Line, expanded)
	fmt.Fprintf(b, "% 10s%s%s\n", "", strings.Repeat(" ", pe.Position.Col-1+diff), strings.Repeat("^", pe.Position.Len))
	return b.String()
}

// ErrorWithUsage returns the error with detailed location context and usage
// guidance.
//
// See the documentation on [ParseError].
func (pe ParseError) ErrorWithUsage() string {
	m := pe.ErrorWithPosition()
	if u, ok := pe.err.(interface{ Usage() string }); ok && u.Usage() != "" {
		lines := strings.Split(strings.TrimSpace(u.Usage()), "\n")
		for i := range lines {
			if lines[i] != "" {
				lines[i] = "    " + lines[i]
			}
		}
		return m + "Error help:\n\n" + strings.Join(lines, "\n") + "\n"
	}
	return m
}

func expandTab(s string) string {
	var (
		b    strings.Builder
		l    int
		fill = func(n int) string {
			b := make([]byte, n)
			for i := range b {
				b[i] = ' '
			}
			return string(b)
		}
	)
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case '\t':
			tw := 8 - l%8
			b.WriteString(fill(tw))
			l += tw
		default:
			b.WriteRune(r)
			l += 1
		}
	}
	return b.String()
}

type (
	errLexControl       struct{ r rune }
	errLexEscape        struct{ r rune }
	errLexUTF8          struct{ b byte }
	errParseDate        struct{ v string }
	errLexInlineTableNL struct{}
	errLexStringNL      struct{}
	errParseRange       struct {
		i    any    // int or float
		size string // "int64", "uint16", etc.
	}
	errUnsafeFloat struct {
		i    interface{} // float32 or float64
		size string      // "float32" or "float64"
	}
	errParseDuration struct{ d string }
)

func (e errLexControl) Error() string {
	return fmt.Sprintf("TOML files cannot contain control characters: '0x%02x'", e.r)
}
func (e errLexControl) Usage() string { return "" }

func (e errLexEscape) Error() string        { return fmt.Sprintf(`invalid escape in string '\%c'`, e.r) }
func (e errLexEscape) Usage() string        { return usageEscape }
func (e errLexUTF8) Error() string          { return fmt.Sprintf("invalid UTF-8 byte: 0x%02x", e.b) }
func (e errLexUTF8) Usage() string          { return "" }
func (e errParseDate) Error() string        { return fmt.Sprintf("invalid datetime: %q", e.v) }
func (e errParseDate) Usage() string        { return usageDate }
func (e errLexInlineTableNL) Error() string { return "newlines not allowed within inline tables" }
func (e errLexInlineTableNL) Usage() string { return usageInlineNewline }
func (e errLexStringNL) Error() string      { return "strings cannot contain newlines" }
func (e errLexStringNL) Usage() string      { return usageStringNewline }
func (e errParseRange) Error() string       { return fmt.Sprintf("%v is out of range for %s", e.i, e.size) }
func (e errParseRange) Usage() string       { return usageIntOverflow }
func (e errUnsafeFloat) Error() string {
	return fmt.Sprintf("%v is out of the safe %s range", e.i, e.size)
}
func (e errUnsafeFloat) Usage() string   { return usageUnsafeFloat }
func (e errParseDuration) Error() string { return fmt.Sprintf("invalid duration: %q", e.d) }
func (e errParseDuration) Usage() string { return usageDuration }

const usageEscape = `
A '\' inside a "-delimited string is interpreted as an escape character.

The following escape sequences are supported:
\b, \t, \n, \f, \r, \", \\, \uXXXX, and \UXXXXXXXX

To prevent a '\' from being recognized as an escape character, use either:

- a ' or '''-delimited string; escape characters aren't processed in them; or
- write two backslashes to get a single backslash: '\\'.

If you're trying to add a Windows path (e.g. "C:\Users\martin") then using '/'
instead of '\' will usually also work: "C:/Users/martin".
`

const usageInlineNewline = `
Inline tables must always be on a single line:

    table = {key = 42, second = 43}

It is invalid to split them over multiple lines like so:

    # INVALID
    table = {
        key    = 42,
        second = 43
    }

Use regular for this:

    [table]
    key    = 42
    second = 43
`

const usageStringNewline = `
Strings must always be on a single line, and cannot span more than one line:

    # INVALID
    string = "Hello,
    world!"

Instead use """ or ''' to split strings over multiple lines:

    string = """Hello,
    world!"""
`

const usageIntOverflow = `
This number is too large; this may be an error in the TOML, but it can also be a
bug in the program that uses too small of an integer.

The maximum and minimum values are:

    size   │ lowest         │ highest
    ───────┼────────────────┼──────────────
    int8   │ -128           │ 127
    int16  │ -32,768        │ 32,767
    int32  │ -2,147,483,648 │ 2,147,483,647
    int64  │ -9.2 × 10¹⁷    │ 9.2 × 10¹⁷
    uint8  │ 0              │ 255
    uint16 │ 0              │ 65,535
    uint32 │ 0              │ 4,294,967,295
    uint64 │ 0              │ 1.8 × 10¹⁸

int refers to int32 on 32-bit systems and int64 on 64-bit systems.
`

const usageUnsafeFloat = `
This number is outside of the "safe" range for floating point numbers; whole
(non-fractional) numbers outside the below range can not always be represented
accurately in a float, leading to some loss of accuracy.

Explicitly mark a number as a fractional unit by adding ".0", which will incur
some loss of accuracy; for example:

	f = 2_000_000_000.0

Accuracy ranges:

	float32 =            16,777,215
	float64 = 9,007,199,254,740,991
`

const usageDuration = `
A duration must be as "number<unit>", without any spaces. Valid units are:

    ns         nanoseconds (billionth of a second)
    us, µs     microseconds (millionth of a second)
    ms         milliseconds (thousands of a second)
    s          seconds
    m          minutes
    h          hours

You can combine multiple units; for example "5m10s" for 5 minutes and 10
seconds.
`

const usageDate = `
A TOML datetime must be in one of the following formats:

    2006-01-02T15:04:05Z07:00   Date and time, with timezone.
    2006-01-02T15:04:05         Date and time, but without timezone.
    2006-01-02                  Date without a time or timezone.
    15:04:05                    Just a time, without any timezone.

Seconds may optionally have a fraction, up to nanosecond precision:

    15:04:05.123
    15:04:05.856018510
`

// TOML 1.1:
// The seconds part in times is optional, and may be omitted:
//     2006-01-02T15:04Z07:00
//     2006-01-02T15:04
//     15:04
