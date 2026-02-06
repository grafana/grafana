package aws

import (
	"fmt"
)

// Ternary is an enum allowing an unknown or none state in addition to a bool's
// true and false.
type Ternary int

func (t Ternary) String() string {
	switch t {
	case UnknownTernary:
		return "unknown"
	case FalseTernary:
		return "false"
	case TrueTernary:
		return "true"
	default:
		return fmt.Sprintf("unknown value, %d", int(t))
	}
}

// Bool returns true if the value is TrueTernary, false otherwise.
func (t Ternary) Bool() bool {
	return t == TrueTernary
}

// Enumerations for the values of the Ternary type.
const (
	UnknownTernary Ternary = iota
	FalseTernary
	TrueTernary
)

// BoolTernary returns a true or false Ternary value for the bool provided.
func BoolTernary(v bool) Ternary {
	if v {
		return TrueTernary
	}
	return FalseTernary
}
