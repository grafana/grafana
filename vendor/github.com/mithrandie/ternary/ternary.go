// Package ternary is a Go library to calculate three-valued logic.
//
// This package is based on Kleene's strong logic of indeterminacy.
// Ternary has three truth values, TRUE, FALSE and UNKNOWN.
//
// Numeric representation of truth values
/*
  FALSE:   -1
  UNKNOWN:  0
  TRUE:     1
*/
//
// Truth tables
/*
  NOT(A) - Logical negation
  +---+----+
  | A | ¬A |
  |---+----|
  | F |  T |
  | U |  U |
  | T |  F |
  +---+----+

  AND(A, B) - Logical conjunction. Minimum value of (A, B)
  +--------+-----------|
  |        |     B     |
  | A ∧ B  |---+---+---|
  |        | F | U | T |
  |----+---+---+---+---|
  |    | F | F | F | F |
  | A  | U | F | U | U |
  |    | T | F | U | T |
  +----+---+---+---+---+

  OR(A, B) - Logical disjunction. Maximum value of (A, B)
  +--------+-----------+
  |        |     B     |
  | A ∨ B  |---+---+---|
  |        | F | U | T |
  |----+---+---+---+---|
  |    | F | F | U | T |
  | A  | U | U | U | T |
  |    | T | T | T | T |
  +----+---+---+---+---+

  IMP(A, B) - Logical implication. OR(NOT(A), B)
  +--------+-----------+
  |        |     B     |
  | A → B  |---+---+---|
  |        | F | U | T |
  |----+---+---+---+---|
  |    | F | T | T | T |
  | A  | U | U | U | T |
  |    | T | F | U | T |
  +----+---+---+---+---+

  EQV(A, B) - Logical biconditional. OR(AND(A, B), AND(NOT(A), NOT(B)))
  +--------+-----------+
  |        |     B     |
  | A ↔ B  |---+---+---|
  |        | F | U | T |
  |----+---+---+---+---|
  |    | F | T | U | F |
  | A  | U | U | U | U |
  |    | T | F | U | T |
  +----+---+---+---+---+

*/
package ternary

import (
	"errors"
	"fmt"
	"reflect"
	"strings"
)

// Value represents a truth value
type Value int8

const (
	FALSE Value = iota - 1
	UNKNOWN
	TRUE
)

var literals = map[Value]string{
	FALSE:   "FALSE",
	UNKNOWN: "UNKNOWN",
	TRUE:    "TRUE",
}

// String returns string representation of the value.
func (value Value) String() string {
	return literals[value]
}

// Int returns integer representation of the value.
func (value Value) Int() int64 {
	return reflect.ValueOf(value).Int()
}

// ParseBool returns true if the value is TRUE, otherwise returns false.
func (value Value) ParseBool() bool {
	if value != TRUE {
		return false
	}
	return true
}

// ConvertFromString converts a string to a ternary value.
// If the string is any of "false", "FALSE" and "-1", then it is converted to FALSE.
// If the string is any of "unknown", "UNKNOWN" and "0", then it is converted to UNKNOWN.
// If the string is any of "true", "TRUE" and "1", then it is converted to TRUE.
// Otherwise, returns an error.
func ConvertFromString(s string) (Value, error) {
	switch strings.ToUpper(s) {
	case literals[FALSE], "-1":
		return FALSE, nil
	case literals[TRUE], "1":
		return TRUE, nil
	case literals[UNKNOWN], "0":
		return UNKNOWN, nil
	}
	return UNKNOWN, errors.New(fmt.Sprintf("convert from %q: invalid value", s))
}

// ConvertFromInt64 converts an integer to a ternary value.
// Returns FALSE if the integer is -1, returns UNKNOWN if it is 0, and returns TRUE if it is 1.
// Otherwise, returns an error.
func ConvertFromInt64(i int64) (Value, error) {
	switch i {
	case -1:
		return FALSE, nil
	case 0:
		return UNKNOWN, nil
	case 1:
		return TRUE, nil
	}
	return UNKNOWN, errors.New(fmt.Sprintf("convert from %d: invalid value", i))
}

// ConvertFromBool converts a boolean to a ternary value.
// Returns FALSE if the boolean is false, returns TRUE if it is true.
func ConvertFromBool(b bool) Value {
	if b {
		return TRUE
	}
	return FALSE
}

// Equal checks if two values are the same value, not logical equality.
func Equal(a Value, b Value) Value {
	return ConvertFromBool(a == b)
}

// Not returns the result of logical negation for a value.
func Not(a Value) Value {
	return a * -1
}

// And returns the result of logical conjunction for two values.
func And(a Value, b Value) Value {
	if a < b {
		return a
	}
	return b
}

// Or returns the result of logical disjunction for two values.
func Or(a Value, b Value) Value {
	if a > b {
		return a
	}
	return b
}

// Imp returns the result of logical implication that is represented as "a implies b".
func Imp(a Value, b Value) Value {
	return Or(Not(a), b)
}

// Eqv returns the result of logical biconditional for two values.
func Eqv(a Value, b Value) Value {
	return a * b
}

// All returns the result of logical conjunction on all values.
func All(values []Value) Value {
	t := TRUE
	for i := 0; i < len(values); i++ {
		t = And(t, values[i])
		if t == FALSE {
			return FALSE
		}
	}
	return t
}

// Any returns the result of logical disjunction on all values.
func Any(values []Value) Value {
	t := FALSE
	for i := 0; i < len(values); i++ {
		t = Or(t, values[i])
		if t == TRUE {
			return TRUE
		}
	}
	return t
}
