package protocol

import (
	"errors"
	"io"
)

// strError is a simple string-based error type that implements the error interface.
// It allows creating lightweight error values from string constants without
// allocating a new error for each instance.
type strError string

// Error implements the error interface by returning the string value of the error.
func (e strError) Error() string {
	return string(e)
}

// eofIsUnexpected checks if the error is an io.EOF.
// If it is, we return io.ErrUnexpectedEOF.
// If not, we return the input error verbatim.
func eofIsUnexpected(err error) error {
	if errors.Is(err, io.EOF) {
		return io.ErrUnexpectedEOF
	} else {
		return err
	}
}
