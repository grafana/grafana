package typesystem

import (
	"errors"
	"fmt"

	"github.com/openfga/openfga/pkg/tuple"
)

var (
	// ErrModelNotFound is returned when an authorization model is not found.
	ErrModelNotFound = errors.New("authorization model not found")

	// ErrDuplicateTypes is returned when an authorization model contains duplicate types.
	ErrDuplicateTypes = errors.New("an authorization model cannot contain duplicate types")

	// ErrInvalidSchemaVersion is returned for an invalid schema version in the authorization model.
	ErrInvalidSchemaVersion = errors.New("invalid schema version")

	// ErrInvalidModel is returned when encountering an invalid authorization model.
	ErrInvalidModel = errors.New("invalid authorization model encountered")

	// ErrRelationUndefined is returned when encountering an undefined relation in the authorization model.
	ErrRelationUndefined = errors.New("undefined relation")

	// ErrObjectTypeUndefined is returned when encountering an undefined object type in the authorization model.
	ErrObjectTypeUndefined = errors.New("undefined object type")

	// ErrInvalidUsersetRewrite is returned for an invalid userset rewrite definition.
	ErrInvalidUsersetRewrite = errors.New("invalid userset rewrite definition")

	// ErrReservedKeywords is returned when using reserved keywords "self" and "this".
	ErrReservedKeywords = errors.New("self and this are reserved keywords")

	// ErrCycle is returned when a cycle is detected in an authorization model.
	// This occurs if an objectType and relation in the model define a rewrite
	// rule that is self-referencing through computed relationships.
	ErrCycle = errors.New("an authorization model cannot contain a cycle")

	// ErrNoEntrypoints is returned when a particular objectType and relation in an authorization
	// model are not accessible via a direct edge, for example from another objectType.
	ErrNoEntrypoints = errors.New("no entrypoints defined")

	// ErrNoEntryPointsLoop is returned when an authorization model contains a cycle
	// because at least one objectType and relation returned ErrNoEntrypoints.
	ErrNoEntryPointsLoop = errors.New("potential loop")

	// ErrNoConditionForRelation is returned when no condition is defined for a relation in the authorization model.
	ErrNoConditionForRelation = errors.New("no condition defined for relation")

	// ErrInvalidRelation is returned when a model failed due to invalid relation.
	ErrInvalidRelation = errors.New("invalid relation")
)

// InvalidTypeError represents an error indicating an invalid object type.
type InvalidTypeError struct {
	ObjectType string
	Cause      error
}

// Error implements the error interface for InvalidTypeError.
func (e *InvalidTypeError) Error() string {
	return fmt.Sprintf("the definition of type '%s' is invalid", e.ObjectType)
}

// Unwrap returns the underlying cause of the error.
func (e *InvalidTypeError) Unwrap() error {
	return e.Cause
}

// InvalidRelationError represents an error indicating an invalid relation definition.
type InvalidRelationError struct {
	ObjectType string
	Relation   string
	Cause      error
}

// Error implements the error interface for InvalidRelationError.
func (e *InvalidRelationError) Error() string {
	return fmt.Sprintf("the definition of relation '%s' in object type '%s' is invalid: %s", e.Relation, e.ObjectType, e.Cause)
}

// Unwrap returns the underlying cause of the error.
func (e *InvalidRelationError) Unwrap() error {
	return e.Cause
}

// ObjectTypeUndefinedError represents an error indicating an undefined object type.
type ObjectTypeUndefinedError struct {
	ObjectType string
	Err        error
}

// Error implements the error interface for ObjectTypeUndefinedError.
func (e *ObjectTypeUndefinedError) Error() string {
	return fmt.Sprintf("'%s' is an undefined object type", e.ObjectType)
}

// Unwrap returns the underlying cause of the error.
func (e *ObjectTypeUndefinedError) Unwrap() error {
	return e.Err
}

// RelationUndefinedError represents an error indicating an undefined relation.
type RelationUndefinedError struct {
	ObjectType string
	Relation   string
	Err        error
}

// Error implements the error interface for RelationUndefinedError.
func (e *RelationUndefinedError) Error() string {
	if e.ObjectType != "" {
		return fmt.Sprintf("'%s#%s' relation is undefined", e.ObjectType, e.Relation)
	}

	return fmt.Sprintf("'%s' relation is undefined", e.Relation)
}

// Unwrap returns the underlying cause of the error.
func (e *RelationUndefinedError) Unwrap() error {
	return e.Err
}

// RelationConditionError represents an error indicating an undefined condition for a relation.
type RelationConditionError struct {
	Condition string
	Relation  string
	Err       error
}

// Error implements the error interface for RelationConditionError.
func (e *RelationConditionError) Error() string {
	return fmt.Sprintf("condition %s is undefined for relation %s", e.Condition, e.Relation)
}

// Unwrap returns the underlying cause of the error.
func (e *RelationConditionError) Unwrap() error {
	return e.Err
}

// AssignableRelationError returns an error for an assignable relation with no relation types defined.
func AssignableRelationError(objectType, relation string) error {
	return fmt.Errorf("the assignable relation '%s' in object type '%s' must contain at least one relation type", relation, objectType)
}

// NonAssignableRelationError returns an error for a non-assignable relation with a relation type defined.
func NonAssignableRelationError(objectType, relation string) error {
	return fmt.Errorf("the non-assignable relation '%s' in object type '%s' should not contain a relation type", relation, objectType)
}

// InvalidRelationTypeError returns an error for an invalid relation type in a relation definition.
func InvalidRelationTypeError(objectType, relation, relatedObjectType, relatedRelation string) error {
	relationType := relatedObjectType
	if relatedRelation != "" {
		relationType = tuple.ToObjectRelationString(relatedObjectType, relatedRelation)
	}

	return fmt.Errorf("the relation type '%s' on '%s' in object type '%s' is not valid", relationType, relation, objectType)
}
