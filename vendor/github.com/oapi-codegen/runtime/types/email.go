package types

import (
	"encoding/json"
	"errors"
)

// ErrValidationEmail is the sentinel error returned when an email fails validation
var ErrValidationEmail = errors.New("email: failed to pass regex validation")

// Email represents an email address.
// It is a string type that must pass regex validation before being marshalled
// to JSON or unmarshalled from JSON.
type Email string

func (e Email) MarshalJSON() ([]byte, error) {
	if !emailRegex.MatchString(string(e)) {
		return nil, ErrValidationEmail
	}

	return json.Marshal(string(e))
}

func (e *Email) UnmarshalJSON(data []byte) error {
	if e == nil {
		return nil
	}

	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}

	*e = Email(s)
	if !emailRegex.MatchString(s) {
		return ErrValidationEmail
	}

	return nil
}
