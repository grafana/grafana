package smithy

import (
	"bytes"
	"fmt"
	"strings"
)

// An InvalidParamsError provides wrapping of invalid parameter errors found when
// validating API operation input parameters.
type InvalidParamsError struct {
	// Context is the base context of the invalid parameter group.
	Context string
	errs    []InvalidParamError
}

// Add adds a new invalid parameter error to the collection of invalid
// parameters. The context of the invalid parameter will be updated to reflect
// this collection.
func (e *InvalidParamsError) Add(err InvalidParamError) {
	err.SetContext(e.Context)
	e.errs = append(e.errs, err)
}

// AddNested adds the invalid parameter errors from another InvalidParamsError
// value into this collection. The nested errors will have their nested context
// updated and base context to reflect the merging.
//
// Use for nested validations errors.
func (e *InvalidParamsError) AddNested(nestedCtx string, nested InvalidParamsError) {
	for _, err := range nested.errs {
		err.SetContext(e.Context)
		err.AddNestedContext(nestedCtx)
		e.errs = append(e.errs, err)
	}
}

// Len returns the number of invalid parameter errors
func (e *InvalidParamsError) Len() int {
	return len(e.errs)
}

// Error returns the string formatted form of the invalid parameters.
func (e InvalidParamsError) Error() string {
	w := &bytes.Buffer{}
	fmt.Fprintf(w, "%d validation error(s) found.\n", len(e.errs))

	for _, err := range e.errs {
		fmt.Fprintf(w, "- %s\n", err.Error())
	}

	return w.String()
}

// Errs returns a slice of the invalid parameters
func (e InvalidParamsError) Errs() []error {
	errs := make([]error, len(e.errs))
	for i := 0; i < len(errs); i++ {
		errs[i] = e.errs[i]
	}

	return errs
}

// An InvalidParamError represents an invalid parameter error type.
type InvalidParamError interface {
	error

	// Field name the error occurred on.
	Field() string

	// SetContext updates the context of the error.
	SetContext(string)

	// AddNestedContext updates the error's context to include a nested level.
	AddNestedContext(string)
}

type invalidParamError struct {
	context       string
	nestedContext string
	field         string
	reason        string
}

// Error returns the string version of the invalid parameter error.
func (e invalidParamError) Error() string {
	return fmt.Sprintf("%s, %s.", e.reason, e.Field())
}

// Field Returns the field and context the error occurred.
func (e invalidParamError) Field() string {
	sb := &strings.Builder{}
	sb.WriteString(e.context)
	if sb.Len() > 0 {
		if len(e.nestedContext) == 0 || (len(e.nestedContext) > 0 && e.nestedContext[:1] != "[") {
			sb.WriteRune('.')
		}
	}
	if len(e.nestedContext) > 0 {
		sb.WriteString(e.nestedContext)
		sb.WriteRune('.')
	}
	sb.WriteString(e.field)
	return sb.String()
}

// SetContext updates the base context of the error.
func (e *invalidParamError) SetContext(ctx string) {
	e.context = ctx
}

// AddNestedContext prepends a context to the field's path.
func (e *invalidParamError) AddNestedContext(ctx string) {
	if len(e.nestedContext) == 0 {
		e.nestedContext = ctx
		return
	}
	// Check if our nested context is an index into a slice or map
	if e.nestedContext[:1] != "[" {
		e.nestedContext = fmt.Sprintf("%s.%s", ctx, e.nestedContext)
		return
	}
	e.nestedContext = ctx + e.nestedContext
}

// An ParamRequiredError represents an required parameter error.
type ParamRequiredError struct {
	invalidParamError
}

// NewErrParamRequired creates a new required parameter error.
func NewErrParamRequired(field string) *ParamRequiredError {
	return &ParamRequiredError{
		invalidParamError{
			field:  field,
			reason: fmt.Sprintf("missing required field"),
		},
	}
}
