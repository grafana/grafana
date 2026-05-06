package jsonschema

// Flag is output format with simple boolean property valid.
type Flag struct {
	Valid bool `json:"valid"`
}

// FlagOutput returns output in flag format
func (ve *ValidationError) FlagOutput() Flag {
	return Flag{}
}

// Basic ---

// Basic is output format with flat list of output units.
type Basic struct {
	Valid  bool         `json:"valid"`
	Errors []BasicError `json:"errors"`
}

// BasicError is output unit in basic format.
type BasicError struct {
	KeywordLocation         string `json:"keywordLocation"`
	AbsoluteKeywordLocation string `json:"absoluteKeywordLocation"`
	InstanceLocation        string `json:"instanceLocation"`
	Error                   string `json:"error"`
}

// BasicOutput returns output in basic format
func (ve *ValidationError) BasicOutput() Basic {
	var errors []BasicError
	var flatten func(*ValidationError)
	flatten = func(ve *ValidationError) {
		errors = append(errors, BasicError{
			KeywordLocation:         ve.KeywordLocation,
			AbsoluteKeywordLocation: ve.AbsoluteKeywordLocation,
			InstanceLocation:        ve.InstanceLocation,
			Error:                   ve.Message,
		})
		for _, cause := range ve.Causes {
			flatten(cause)
		}
	}
	flatten(ve)
	return Basic{Errors: errors}
}

// Detailed ---

// Detailed is output format based on structure of schema.
type Detailed struct {
	Valid                   bool       `json:"valid"`
	KeywordLocation         string     `json:"keywordLocation"`
	AbsoluteKeywordLocation string     `json:"absoluteKeywordLocation"`
	InstanceLocation        string     `json:"instanceLocation"`
	Error                   string     `json:"error,omitempty"`
	Errors                  []Detailed `json:"errors,omitempty"`
}

// DetailedOutput returns output in detailed format
func (ve *ValidationError) DetailedOutput() Detailed {
	var errors []Detailed
	for _, cause := range ve.Causes {
		errors = append(errors, cause.DetailedOutput())
	}
	var message = ve.Message
	if len(ve.Causes) > 0 {
		message = ""
	}
	return Detailed{
		KeywordLocation:         ve.KeywordLocation,
		AbsoluteKeywordLocation: ve.AbsoluteKeywordLocation,
		InstanceLocation:        ve.InstanceLocation,
		Error:                   message,
		Errors:                  errors,
	}
}
