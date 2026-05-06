package condition

import (
	"errors"
	"fmt"

	"github.com/natefinch/wrap"
)

var ErrEvaluationFailed = fmt.Errorf("failed to evaluate relationship condition")

type CompilationError struct {
	Condition string
	Cause     error
}

func (e *CompilationError) Error() string {
	return fmt.Sprintf("failed to compile expression on condition '%s' - %v", e.Condition, e.Cause)
}

func (e *CompilationError) Unwrap() error {
	return e.Cause
}

type EvaluationError struct {
	Condition string
	Cause     error
}

func NewEvaluationError(condition string, cause error) error {
	return wrap.With(&EvaluationError{
		Condition: condition,
		Cause:     cause,
	}, ErrEvaluationFailed)
}

func (e *EvaluationError) Error() string {
	var pTypeErr *ParameterTypeError
	if errors.As(e.Cause, &pTypeErr) {
		return e.Unwrap().Error()
	}

	return fmt.Sprintf("'%s' - %v", e.Condition, e.Cause)
}

func (e *EvaluationError) Unwrap() error {
	return e.Cause
}

type ParameterTypeError struct {
	Condition string
	Cause     error
}

func (e *ParameterTypeError) Error() string {
	return fmt.Sprintf("parameter type error on condition '%s' - %v", e.Condition, e.Cause)
}

func (e *ParameterTypeError) Unwrap() error {
	return e.Cause
}
