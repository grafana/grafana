// Copyright 2022 PerimeterX. All rights reserved.
// Use of this source code is governed by a MIT style
// license that can be found in the LICENSE file.

package marshmallow

import (
	"errors"
	"fmt"
	"github.com/mailru/easyjson/jlexer"
	"reflect"
	"strings"
)

var (
	// ErrInvalidInput indicates the input JSON is invalid
	ErrInvalidInput = errors.New("invalid JSON input")

	// ErrInvalidValue indicates the target struct has invalid type
	ErrInvalidValue = errors.New("unexpected non struct value")
)

// MultipleLexerError indicates one or more unmarshalling errors during JSON bytes decode
type MultipleLexerError struct {
	Errors []*jlexer.LexerError
}

func (m *MultipleLexerError) Error() string {
	errs := make([]string, len(m.Errors))
	for i, lexerError := range m.Errors {
		errs[i] = lexerError.Error()
	}
	return strings.Join(errs, ", ")
}

// MultipleError indicates one or more unmarshalling errors during JSON map decode
type MultipleError struct {
	Errors []error
}

func (m *MultipleError) Error() string {
	errs := make([]string, len(m.Errors))
	for i, lexerError := range m.Errors {
		errs[i] = lexerError.Error()
	}
	return strings.Join(errs, ", ")
}

// ParseError indicates a JSON map decode error
type ParseError struct {
	Reason string
	Path   string
}

func (p *ParseError) Error() string {
	return fmt.Sprintf("parse error: %s in %s", p.Reason, p.Path)
}

func newUnexpectedTypeParseError(expectedType reflect.Type, path []string) *ParseError {
	return &ParseError{
		Reason: fmt.Sprintf("expected type %s", externalTypeName(expectedType)),
		Path:   strings.Join(path, "."),
	}
}

func newUnsupportedTypeParseError(unsupportedType reflect.Type, path []string) *ParseError {
	return &ParseError{
		Reason: fmt.Sprintf("unsupported type %s", externalTypeName(unsupportedType)),
		Path:   strings.Join(path, "."),
	}
}

func addUnexpectedTypeLexerError(lexer *jlexer.Lexer, expectedType reflect.Type) {
	lexer.AddNonFatalError(fmt.Errorf("expected type %s", externalTypeName(expectedType)))
}

func addUnsupportedTypeLexerError(lexer *jlexer.Lexer, unsupportedType reflect.Type) {
	lexer.AddNonFatalError(fmt.Errorf("unsupported type %s", externalTypeName(unsupportedType)))
}

func externalTypeName(t reflect.Type) string {
	switch t.Kind() {
	case reflect.String:
		return "string"
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Uint,
		reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr, reflect.Float32,
		reflect.Float64, reflect.Complex64, reflect.Complex128:
		return "number"
	case reflect.Bool:
		return "boolean"
	case reflect.Array, reflect.Slice:
		return "array"
	case reflect.Interface:
		return "any"
	case reflect.Map, reflect.Struct:
		return "object"
	case reflect.Ptr:
		return externalTypeName(t.Elem())
	}
	return "invalid"
}
