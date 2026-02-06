package ini

import "fmt"

// UnableToReadFile is an error indicating that a ini file could not be read
type UnableToReadFile struct {
	Err error
}

// Error returns an error message and the underlying error message if present
func (e *UnableToReadFile) Error() string {
	base := "unable to read file"
	if e.Err == nil {
		return base
	}
	return fmt.Sprintf("%s: %v", base, e.Err)
}

// Unwrap returns the underlying error
func (e *UnableToReadFile) Unwrap() error {
	return e.Err
}
