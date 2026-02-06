package retry

import "fmt"

// MaxAttemptsError provides the error when the maximum number of attempts have
// been exceeded.
type MaxAttemptsError struct {
	Attempt int
	Err     error
}

func (e *MaxAttemptsError) Error() string {
	return fmt.Sprintf("exceeded maximum number of attempts, %d, %v", e.Attempt, e.Err)
}

// Unwrap returns the nested error causing the max attempts error. Provides the
// implementation for errors.Is and errors.As to unwrap nested errors.
func (e *MaxAttemptsError) Unwrap() error {
	return e.Err
}
