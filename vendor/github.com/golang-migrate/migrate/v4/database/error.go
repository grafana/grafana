package database

import (
	"fmt"
)

// Error should be used for errors involving queries ran against the database
type Error struct {
	// Optional: the line number
	Line uint

	// Query is a query excerpt
	Query []byte

	// Err is a useful/helping error message for humans
	Err string

	// OrigErr is the underlying error
	OrigErr error
}

func (e Error) Error() string {
	if len(e.Err) == 0 {
		return fmt.Sprintf("%v in line %v: %s", e.OrigErr, e.Line, e.Query)
	}
	return fmt.Sprintf("%v in line %v: %s (details: %v)", e.Err, e.Line, e.Query, e.OrigErr)
}
