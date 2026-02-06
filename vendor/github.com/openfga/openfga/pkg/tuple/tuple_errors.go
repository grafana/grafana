package tuple

import (
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

// InvalidConditionalTupleError is returned if the tuple's condition is invalid.
type InvalidConditionalTupleError struct {
	Cause    error
	TupleKey TupleWithCondition
}

func (i *InvalidConditionalTupleError) Error() string {
	return fmt.Sprintf("Invalid tuple '%s'. Reason: %s", TupleKeyWithConditionToString(i.TupleKey), i.Cause)
}

func (i *InvalidConditionalTupleError) Is(target error) bool {
	_, ok := target.(*InvalidConditionalTupleError)
	return ok
}

// InvalidTupleError is returned if the tuple is invalid.
type InvalidTupleError struct {
	Cause    error
	TupleKey TupleWithoutCondition
}

func (i *InvalidTupleError) Error() string {
	return fmt.Sprintf("Invalid tuple '%s'. Reason: %s", TupleKeyToString(i.TupleKey), i.Cause)
}

func (i *InvalidTupleError) Is(target error) bool {
	_, ok := target.(*InvalidTupleError)
	return ok
}

type TypeNotFoundError struct {
	TypeName string
}

func (i *TypeNotFoundError) Error() string {
	return fmt.Sprintf("type '%s' not found", i.TypeName)
}

func (i *TypeNotFoundError) Is(target error) bool {
	_, ok := target.(*TypeNotFoundError)
	return ok
}

type RelationNotFoundError struct {
	TupleKey *openfgav1.TupleKey
	Relation string
	TypeName string
}

func (i *RelationNotFoundError) Error() string {
	msg := fmt.Sprintf("relation '%s#%s' not found", i.TypeName, i.Relation)
	if i.TupleKey != nil {
		msg += fmt.Sprintf(" for tuple '%s'", TupleKeyToString(i.TupleKey))
	}

	return msg
}

func (i *RelationNotFoundError) Is(target error) bool {
	_, ok := target.(*RelationNotFoundError)
	return ok
}
