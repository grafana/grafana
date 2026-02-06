package interpolate

import (
	"bytes"
	"fmt"
)

// Interpolate takes a set of environment and interpolates it into the provided string using shell
// script expansions
func Interpolate(env Env, str string) (string, error) {
	if env == nil {
		env = NewSliceEnv(nil)
	}
	expr, err := NewParser(str).Parse()
	if err != nil {
		return "", err
	}
	return expr.Expand(env)
}

// Indentifiers parses the identifiers from any expansions in the provided string
func Identifiers(str string) ([]string, error) {
	expr, err := NewParser(str).Parse()
	if err != nil {
		return nil, err
	}
	return expr.Identifiers(), nil
}

// An expansion is something that takes in ENV and returns a string or an error
type Expansion interface {
	Expand(env Env) (string, error)
	Identifiers() []string
}

// VariableExpansion represents either $VAR or ${VAR}, our simplest expansion
type VariableExpansion struct {
	Identifier string
}

func (e VariableExpansion) Identifiers() []string {
	return []string{e.Identifier}
}

func (e VariableExpansion) Expand(env Env) (string, error) {
	val, _ := env.Get(e.Identifier)
	return val, nil
}

// EmptyValueExpansion returns either the value of an env, or a default value if it's unset or null
type EmptyValueExpansion struct {
	Identifier string
	Content    Expression
}

func (e EmptyValueExpansion) Identifiers() []string {
	return append([]string{e.Identifier}, e.Content.Identifiers()...)
}

func (e EmptyValueExpansion) Expand(env Env) (string, error) {
	val, _ := env.Get(e.Identifier)
	if val == "" {
		return e.Content.Expand(env)
	}
	return val, nil
}

// UnsetValueExpansion returns either the value of an env, or a default value if it's unset
type UnsetValueExpansion struct {
	Identifier string
	Content    Expression
}

func (e UnsetValueExpansion) Identifiers() []string {
	return []string{e.Identifier}
}

func (e UnsetValueExpansion) Expand(env Env) (string, error) {
	val, ok := env.Get(e.Identifier)
	if !ok {
		return e.Content.Expand(env)
	}
	return val, nil
}

// SubstringExpansion returns a substring (or slice) of the env
type SubstringExpansion struct {
	Identifier string
	Offset     int
	Length     int
	HasLength  bool
}

func (e SubstringExpansion) Identifiers() []string {
	return []string{e.Identifier}
}

func (e SubstringExpansion) Expand(env Env) (string, error) {
	val, _ := env.Get(e.Identifier)

	from := e.Offset

	// Negative offsets = from end
	if from < 0 {
		from += len(val)
	}

	// Still negative = too far from end? Truncate to start.
	if from < 0 {
		from = 0
	}

	// Beyond end? Truncate to end.
	if from > len(val) {
		from = len(val)
	}

	if !e.HasLength {
		return val[from:], nil
	}

	to := e.Length

	if to >= 0 {
		// Positive length = from offset
		to += from
	} else {
		// Negative length = from end
		to += len(val)

		// Too far? Truncate to offset.
		if to < from {
			to = from
		}
	}

	// Beyond end? Truncate to end.
	if to > len(val) {
		to = len(val)
	}

	return val[from:to], nil
}

// RequiredExpansion returns an env value, or an error if it is unset
type RequiredExpansion struct {
	Identifier string
	Message    Expression
}

func (e RequiredExpansion) Identifiers() []string {
	return []string{e.Identifier}
}

func (e RequiredExpansion) Expand(env Env) (string, error) {
	val, ok := env.Get(e.Identifier)
	if !ok {
		msg, err := e.Message.Expand(env)
		if err != nil {
			return "", err
		}
		if msg == "" {
			msg = "not set"
		}
		return "", fmt.Errorf("$%s: %s", e.Identifier, msg)
	}
	return val, nil
}

// Expression is a collection of either Text or Expansions
type Expression []ExpressionItem

func (e Expression) Identifiers() []string {
	identifiers := []string{}
	for _, item := range e {
		if item.Expansion != nil {
			identifiers = append(identifiers, item.Expansion.Identifiers()...)
		}
	}
	return identifiers
}

func (e Expression) Expand(env Env) (string, error) {
	buf := &bytes.Buffer{}

	for _, item := range e {
		if item.Expansion != nil {
			result, err := item.Expansion.Expand(env)
			if err != nil {
				return "", err
			}
			_, _ = buf.WriteString(result)
		} else {
			_, _ = buf.WriteString(item.Text)
		}
	}

	return buf.String(), nil
}

// ExpressionItem models either an Expansion or Text. Either/Or, never both.
type ExpressionItem struct {
	Text string
	// -- or --
	Expansion Expansion
}

func (i ExpressionItem) String() string {
	if i.Expansion != nil {
		return fmt.Sprintf("%#v", i.Expansion)
	}
	return fmt.Sprintf("%q", i.Text)
}
