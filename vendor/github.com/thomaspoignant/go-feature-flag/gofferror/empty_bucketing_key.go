package gofferror

import "fmt"

type EmptyBucketingKeyError struct {
	Message string
}

// Implement the Error() method for the custom error type
func (e *EmptyBucketingKeyError) Error() string {
	return fmt.Sprintf("Error: %s", e.Message)
}
