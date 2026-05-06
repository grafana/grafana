package interpolate

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

// This is a recursive descent parser for our grammar. Because it can contain nested expressions
// like ${LLAMAS:-${ROCK:-true}} we can't use regular expressions. The simplest possible alternative
// is a recursive parser like this. It parses a chunk and then calls a function to parse that
// further and so on and so forth. It results in a tree of objects that represent the things we've
// parsed (an AST). This means that the logic for how expansions work lives in those objects, and
// the logic for how we go from plain text to parsed objects lives here.
//
// To keep things simple, we do our "lexing" or "scanning" just as a few functions at the end of the
// file rather than as a dedicated lexer that emits tokens. This matches the simplicity of the
// format we are parsing relatively well
//
// Below is an EBNF grammar for the language. The parser was built by basically turning this into
// functions and structs named the same reading the string bite by bite (peekRune and nextRune)

/*
EscapedBackslash = "\\" EscapedDollar    = ( "\$" | "$$") Identifier       = letter { letters |
digit | "_" } Expansion        = "$" ( Identifier | Brace ) Brace            = "{" Identifier [
Identifier BraceOperation ] "}" Text = { EscapedBackslash | EscapedDollar | all characters except
"$" } Expression = { Text | Expansion } EmptyValue       = ":-" { Expression } UnsetValue       =
"-" { Expression } Substring        = ":" number [ ":" number ] Required = "?" { Expression }
Operation        = EmptyValue | UnsetValue | Substring | Required
*/

const (
	eof = -1
)

// Parser takes a string and parses out a tree of structs that represent text and Expansions
type Parser struct {
	input string // the string we are scanning
	pos   int    // the current position
}

// NewParser returns a new instance of a Parser
func NewParser(str string) *Parser {
	return &Parser{
		input: str,
		pos:   0,
	}
}

// Parse expansions out of the internal text and return them as a tree of Expressions
func (p *Parser) Parse() (Expression, error) {
	return p.parseExpression()
}

func (p *Parser) parseExpression(stop ...rune) (Expression, error) {
	var expr Expression
	var stopStr = string(stop)

	for {
		c := p.peekRune()
		if c == eof || strings.ContainsRune(stopStr, c) {
			break
		}

		// check for our escaped characters first, as we assume nothing subsequently is escaped
		if strings.HasPrefix(p.input[p.pos:], `\\`) {
			p.pos += 2
			expr = append(expr, ExpressionItem{Text: `\\`})
			continue
		} else if strings.HasPrefix(p.input[p.pos:], `\$`) || strings.HasPrefix(p.input[p.pos:], `$$`) {
			p.pos += 2
			expr = append(expr, ExpressionItem{Text: `$`})
			continue
		}

		// Ignore bash shell expansions
		if strings.HasPrefix(p.input[p.pos:], `$(`) {
			p.pos += 2
			expr = append(expr, ExpressionItem{Text: `$(`})
			continue
		}

		// If we run into a dollar sign and it's not the last char, it's an expansion
		if c == '$' && p.pos < (len(p.input)-1) {
			expansion, err := p.parseExpansion()
			if err != nil {
				return nil, err
			}
			expr = append(expr, ExpressionItem{Expansion: expansion})
			continue
		}

		// nibble a character, otherwise if it's a \ or a $ we can loop
		c = p.nextRune()

		// Scan as much as we can into text
		text := p.scanUntil(func(r rune) bool {
			return (r == '$' || r == '\\' || strings.ContainsRune(stopStr, r))
		})

		expr = append(expr, ExpressionItem{Text: string(c) + text})
	}

	return expr, nil
}

func (p *Parser) parseExpansion() (Expansion, error) {
	if c := p.nextRune(); c != '$' {
		return nil, fmt.Errorf("Expected expansion to start with $, got %c", c)
	}

	// if we have an open brace, this is a brace expansion
	if c := p.peekRune(); c == '{' {
		return p.parseBraceExpansion()
	}

	identifier, err := p.scanIdentifier()
	if err != nil {
		return nil, err
	}

	return VariableExpansion{Identifier: identifier}, nil
}

func (p *Parser) parseBraceExpansion() (Expansion, error) {
	if c := p.nextRune(); c != '{' {
		return nil, fmt.Errorf("Expected brace expansion to start with {, got %c", c)
	}

	identifier, err := p.scanIdentifier()
	if err != nil {
		return nil, err
	}

	if c := p.peekRune(); c == '}' {
		_ = p.nextRune()
		return VariableExpansion{Identifier: identifier}, nil
	}

	var operator string
	var exp Expansion

	// Parse an operator, some trickery is needed to handle : vs :-
	if op1 := p.nextRune(); op1 == ':' {
		if op2 := p.peekRune(); op2 == '-' {
			_ = p.nextRune()
			operator = ":-"
		} else {
			operator = ":"
		}
	} else if op1 == '?' || op1 == '-' {
		operator = string(op1)
	} else {
		return nil, fmt.Errorf("Expected an operator, got %c", op1)
	}

	switch operator {
	case `:-`:
		exp, err = p.parseEmptyValueExpansion(identifier)
		if err != nil {
			return nil, err
		}
	case `-`:
		exp, err = p.parseUnsetValueExpansion(identifier)
		if err != nil {
			return nil, err
		}
	case `:`:
		exp, err = p.parseSubstringExpansion(identifier)
		if err != nil {
			return nil, err
		}
	case `?`:
		exp, err = p.parseRequiredExpansion(identifier)
		if err != nil {
			return nil, err
		}
	}

	if c := p.nextRune(); c != '}' {
		return nil, fmt.Errorf("Expected brace expansion to end with }, got %c", c)
	}

	return exp, nil
}

func (p *Parser) parseEmptyValueExpansion(identifier string) (Expansion, error) {
	// parse an expression (text and expansions) up until the end of the brace
	expr, err := p.parseExpression('}')
	if err != nil {
		return nil, err
	}

	return EmptyValueExpansion{Identifier: identifier, Content: expr}, nil
}

func (p *Parser) parseUnsetValueExpansion(identifier string) (Expansion, error) {
	expr, err := p.parseExpression('}')
	if err != nil {
		return nil, err
	}

	return UnsetValueExpansion{Identifier: identifier, Content: expr}, nil
}

func (p *Parser) parseSubstringExpansion(identifier string) (Expansion, error) {
	offset := p.scanUntil(func(r rune) bool {
		return r == ':' || r == '}'
	})

	offsetInt, err := strconv.Atoi(strings.TrimSpace(offset))
	if err != nil {
		return nil, fmt.Errorf("Unable to parse offset: %v", err)
	}

	if c := p.peekRune(); c == '}' {
		return SubstringExpansion{Identifier: identifier, Offset: offsetInt}, nil
	}

	_ = p.nextRune()
	length := p.scanUntil(func(r rune) bool {
		return r == '}'
	})

	lengthInt, err := strconv.Atoi(strings.TrimSpace(length))
	if err != nil {
		return nil, fmt.Errorf("Unable to parse length: %v", err)
	}

	return SubstringExpansion{Identifier: identifier, Offset: offsetInt, Length: lengthInt, HasLength: true}, nil
}

func (p *Parser) parseRequiredExpansion(identifier string) (Expansion, error) {
	expr, err := p.parseExpression('}')
	if err != nil {
		return nil, err
	}

	return RequiredExpansion{Identifier: identifier, Message: expr}, nil
}

func (p *Parser) scanUntil(f func(rune) bool) string {
	start := p.pos
	for int(p.pos) < len(p.input) {
		c, size := utf8.DecodeRuneInString(p.input[p.pos:])
		if c == utf8.RuneError || f(c) {
			break
		}
		p.pos += size
	}
	return p.input[start:p.pos]
}

func (p *Parser) scanIdentifier() (string, error) {
	if c := p.peekRune(); !unicode.IsLetter(c) {
		return "", fmt.Errorf("Expected identifier to start with a letter, got %c", c)
	}
	var notIdentifierChar = func(r rune) bool {
		return (!unicode.IsLetter(r) && !unicode.IsNumber(r) && r != '_')
	}
	return p.scanUntil(notIdentifierChar), nil
}

func (p *Parser) nextRune() rune {
	if int(p.pos) >= len(p.input) {
		return eof
	}
	c, size := utf8.DecodeRuneInString(p.input[p.pos:])
	p.pos += size
	return c
}

func (p *Parser) peekRune() rune {
	if int(p.pos) >= len(p.input) {
		return eof
	}
	c, _ := utf8.DecodeRuneInString(p.input[p.pos:])
	return c
}
