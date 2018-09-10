package crate

// Specific Crate errors returned by the endpoint.
// Use this to type check for database errors.
type CrateErr struct {
	Code    int
	Message string
}

// Return error message, this is part of the error interface.
func (e *CrateErr) Error() string {
	return e.Message
}
