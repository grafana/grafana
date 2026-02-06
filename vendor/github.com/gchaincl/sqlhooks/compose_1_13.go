// +build go1.13

package sqlhooks

import "errors"

// Is returns true if any of the wrapped errors is target according to errors.Is()
func (m MultipleErrors) Is(target error) bool {
	for _, err := range m {
		if errors.Is(err, target) {
			return true
		}
	}
	return false
}

// Is tries to convert each wrapped error to target with errors.As() and returns true that succeeds.
// If none of the errors are convertible, returns false.
func (m MultipleErrors) As(target interface{}) bool {
	for _, err := range m {
		if errors.As(err, &target) {
			return true
		}
	}
	return false
}
