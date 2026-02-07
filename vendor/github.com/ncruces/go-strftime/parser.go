package strftime

import "unicode/utf8"

type parser struct {
	format  func(spec, flag byte) error
	literal func(byte) error
}

func (p *parser) parse(fmt string) error {
	const (
		initial = iota
		percent
		flagged
		modified
	)

	var flag, modifier byte
	var err error
	state := initial
	start := 0
	for i, b := range []byte(fmt) {
		switch state {
		default:
			if b == '%' {
				state = percent
				start = i
				continue
			}
			err = p.literal(b)

		case percent:
			if b == '-' || b == ':' {
				state = flagged
				flag = b
				continue
			}
			if b == 'E' || b == 'O' {
				state = modified
				modifier = b
				flag = 0
				continue
			}
			err = p.format(b, 0)
			state = initial

		case flagged:
			if b == 'E' || b == 'O' {
				state = modified
				modifier = b
				continue
			}
			err = p.format(b, flag)
			state = initial

		case modified:
			if okModifier(modifier, b) {
				err = p.format(b, flag)
			} else {
				err = p.literals(fmt[start : i+1])
			}
			state = initial
		}

		if err != nil {
			if err, ok := err.(formatError); ok {
				err.setDirective(fmt, start, i)
				return err
			}
			return err
		}
	}

	if state != initial {
		return p.literals(fmt[start:])
	}
	return nil
}

func (p *parser) literals(literal string) error {
	for _, b := range []byte(literal) {
		if err := p.literal(b); err != nil {
			return err
		}
	}
	return nil
}

type literalErr string

func (e literalErr) Error() string {
	return "strftime: unsupported literal: " + string(e)
}

type formatError struct {
	message   string
	directive string
}

func (e formatError) Error() string {
	return "strftime: unsupported directive: " + e.directive + " " + e.message
}

func (e *formatError) setDirective(str string, i, j int) {
	_, n := utf8.DecodeRuneInString(str[j:])
	e.directive = str[i : j+n]
}
