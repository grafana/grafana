package pattern

import (
	"fmt"
	"unicode/utf8"
)

type node interface {
	fmt.Stringer
}

type expr []node

func (e expr) hasCapture() bool {
	return e.captureCount() != 0
}

func (e expr) validate() error {
	if !e.hasCapture() {
		return ErrNoCapture
	}
	// Consecutive captures are not allowed.
	if err := e.validateNoConsecutiveCaptures(); err != nil {
		return err
	}
	caps := e.captures()
	uniq := map[string]struct{}{}
	for _, c := range caps {
		if _, ok := uniq[c]; ok {
			return fmt.Errorf("duplicate capture name (%s): %w", c, ErrInvalidExpr)
		}
		uniq[c] = struct{}{}
	}
	return nil
}

func (e expr) validateNoConsecutiveCaptures() error {
	for i, n := range e {
		if i+1 >= len(e) {
			break
		}
		if _, ok := n.(capture); ok {
			if _, ok := e[i+1].(capture); ok {
				return fmt.Errorf("found consecutive capture '%s': %w", n.String()+e[i+1].String(), ErrInvalidExpr)
			}
		}
	}
	return nil
}

func (e expr) validateNoNamedCaptures() error {
	for i, n := range e {
		if c, ok := e[i].(capture); ok && !c.isUnnamed() {
			return fmt.Errorf("%w: found '%s'", ErrCaptureNotAllowed, n.String())
		}
	}
	return nil
}

func (e expr) captures() (captures []string) {
	for _, n := range e {
		if c, ok := n.(capture); ok && !c.isUnnamed() {
			captures = append(captures, c.Name())
		}
	}
	return
}

func (e expr) captureCount() (count int) {
	return len(e.captures())
}

type capture string

func (c capture) String() string {
	return "<" + string(c) + ">"
}

func (c capture) Name() string {
	return string(c)
}

func (c capture) isUnnamed() bool {
	return len(c) == 1 && c[0] == underscore[0]
}

type literals []byte

func (l literals) String() string {
	return string(l)
}

func runesToLiterals(rs []rune) literals {
	res := make([]byte, len(rs)*utf8.UTFMax)
	count := 0
	for _, r := range rs {
		count += utf8.EncodeRune(res[count:], r)
	}
	res = res[:count]
	return res
}
