package json

import (
	"fmt"
)

type DecodeError struct {
	line    int
	char    int
	message string
}

func NewDecodeError(line int, char int, message string) *DecodeError {
	return &DecodeError{
		line:    line,
		char:    char,
		message: message,
	}
}

func (e DecodeError) Error() string {
	return fmt.Sprintf("line %d, column %d: %s", e.line, e.char, e.message)
}

func (e DecodeError) Line() int {
	return e.line
}

func (e DecodeError) Char() int {
	return e.line
}

func (e DecodeError) Message() string {
	return e.message
}

type Decoder struct {
	// Returns numeric values as Integer or Float instead of Number if true.
	UseInteger bool
}

func NewDecoder() *Decoder {
	return &Decoder{}
}

func (d Decoder) Decode(src string) (Structure, EscapeType, error) {
	st, et, err := ParseJson(src, d.UseInteger)
	if err != nil {
		se := err.(*SyntaxError)
		return st, et, NewDecodeError(se.Line, se.Column, se.Error())
	}
	return st, et, nil
}
