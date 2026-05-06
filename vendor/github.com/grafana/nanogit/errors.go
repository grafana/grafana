package nanogit

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
)

var (
	// ErrObjectNotFound is returned when a requested Git object cannot be found in the repository.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrObjectNotFound = errors.New("object not found")

	// ErrObjectAlreadyExists is returned when attempting to create a Git object that already exists.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrObjectAlreadyExists = errors.New("object already exists")

	// ErrUnexpectedObjectType is returned when a Git object has a different type than expected.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrUnexpectedObjectType = errors.New("unexpected object type")

	// ErrNothingToPush is returned when attempting to push changes but no objects have been staged.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrNothingToPush = errors.New("nothing to push")

	// ErrNothingToCommit is returned when attempting to commit but no changes have been staged.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrNothingToCommit = errors.New("nothing to commit")

	// ErrUnexpectedObjectCount is returned when the number of objects returned by the server is unexpected.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrUnexpectedObjectCount = errors.New("unexpected object count")

	// ErrEmptyCommitMessage is returned when attempting to create a commit with an empty message.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrEmptyCommitMessage = errors.New("empty commit message")

	// ErrEmptyPath is returned when a path is empty.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrEmptyPath = errors.New("empty path")

	// ErrEmptyRefName is returned when a ref name is empty.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrEmptyRefName = errors.New("empty ref name")

	// ErrInvalidAuthor is returned when author information is invalid.
	// This error should only be used with errors.Is() for comparison, not for type assertions.
	ErrInvalidAuthor = errors.New("invalid author information")
)

// ObjectNotFoundError provides structured information about a Git object that was not found.
type ObjectNotFoundError struct {
	ObjectID hash.Hash
}

func (e *ObjectNotFoundError) Error() string {
	return "object " + e.ObjectID.String() + " not found"
}

// Unwrap enables errors.Is() compatibility with ErrObjectNotFound
func (e *ObjectNotFoundError) Unwrap() error {
	return ErrObjectNotFound
}

// NewObjectNotFoundError creates a new ObjectNotFoundError with the specified object ID.
func NewObjectNotFoundError(objectID hash.Hash) *ObjectNotFoundError {
	return &ObjectNotFoundError{
		ObjectID: objectID,
	}
}

// ObjectAlreadyExistsError provides structured information about a Git object that already exists.
type ObjectAlreadyExistsError struct {
	ObjectID hash.Hash
}

func (e *ObjectAlreadyExistsError) Error() string {
	return "object " + e.ObjectID.String() + " already exists"
}

// Unwrap enables errors.Is() compatibility with ErrObjectAlreadyExists
func (e *ObjectAlreadyExistsError) Unwrap() error {
	return ErrObjectAlreadyExists
}

// NewObjectAlreadyExistsError creates a new ObjectAlreadyExistsError with the specified object ID.
func NewObjectAlreadyExistsError(objectID hash.Hash) *ObjectAlreadyExistsError {
	return &ObjectAlreadyExistsError{
		ObjectID: objectID,
	}
}

// UnexpectedObjectCountError provides structured information about a Git object with an unexpected count.
type UnexpectedObjectCountError struct {
	ExpectedCount int
	ActualCount   int
	Objects       []*protocol.PackfileObject
}

func (e *UnexpectedObjectCountError) Error() string {
	objectNames := make([]string, 0, len(e.Objects))
	for _, obj := range e.Objects {
		objectNames = append(objectNames, fmt.Sprintf("%s/%s", obj.Type.String(), obj.Hash.String()))
	}
	return "unexpected object count: expected " + strconv.Itoa(e.ExpectedCount) + " but got " + strconv.Itoa(e.ActualCount) + " objects: " + strings.Join(objectNames, ", ")
}

// Unwrap enables errors.Is() compatibility with ErrUnexpectedObjectCount
func (e *UnexpectedObjectCountError) Unwrap() error {
	return ErrUnexpectedObjectCount
}

// NewUnexpectedObjectCountError creates a new UnexpectedObjectCountError with the specified details.
func NewUnexpectedObjectCountError(expectedCount int, objects []*protocol.PackfileObject) *UnexpectedObjectCountError {
	return &UnexpectedObjectCountError{
		ExpectedCount: expectedCount,
		ActualCount:   len(objects),
		Objects:       objects,
	}
}

// UnexpectedObjectTypeError provides structured information about a Git object with an unexpected type.
type UnexpectedObjectTypeError struct {
	ObjectID     hash.Hash
	ExpectedType protocol.ObjectType
	ActualType   protocol.ObjectType
}

func (e *UnexpectedObjectTypeError) Error() string {
	return "object " + e.ObjectID.String() + " has unexpected type " + e.ActualType.String() + " (expected " + e.ExpectedType.String() + ")"
}

// Unwrap enables errors.Is() compatibility with ErrUnexpectedObjectType
func (e *UnexpectedObjectTypeError) Unwrap() error {
	return ErrUnexpectedObjectType
}

// NewUnexpectedObjectTypeError creates a new UnexpectedObjectTypeError with the specified details.
func NewUnexpectedObjectTypeError(objectID hash.Hash, expectedType, actualType protocol.ObjectType) *UnexpectedObjectTypeError {
	return &UnexpectedObjectTypeError{
		ObjectID:     objectID,
		ExpectedType: expectedType,
		ActualType:   actualType,
	}
}

// PathNotFoundError provides structured information about a Git path that was not found.
type PathNotFoundError struct {
	Path string
}

func (e *PathNotFoundError) Error() string {
	return "path not found: " + e.Path
}

// Unwrap enables errors.Is() compatibility with ErrPathNotFound
func (e *PathNotFoundError) Unwrap() error {
	return ErrObjectNotFound
}

// NewPathNotFoundError creates a new PathNotFoundError with the specified path.
func NewPathNotFoundError(path string) *PathNotFoundError {
	return &PathNotFoundError{
		Path: path,
	}
}

// RefNotFoundError provides structured information about a Git reference that was not found.
type RefNotFoundError struct {
	RefName string
}

func (e *RefNotFoundError) Error() string {
	return "reference not found: " + e.RefName
}

// Unwrap enables errors.Is() compatibility with ErrRefNotFound
func (e *RefNotFoundError) Unwrap() error {
	return ErrObjectNotFound
}

// NewRefNotFoundError creates a new RefNotFoundError with the specified reference name.
func NewRefNotFoundError(refName string) *RefNotFoundError {
	return &RefNotFoundError{
		RefName: refName,
	}
}

// RefAlreadyExistsError provides structured information about a Git reference that already exists.
type RefAlreadyExistsError struct {
	RefName string
}

func (e *RefAlreadyExistsError) Error() string {
	return "reference already exists: " + e.RefName
}

// Unwrap enables errors.Is() compatibility with ErrObjectAlreadyExists
func (e *RefAlreadyExistsError) Unwrap() error {
	return ErrObjectAlreadyExists
}

// NewRefAlreadyExistsError creates a new RefAlreadyExistsError with the specified reference name.
func NewRefAlreadyExistsError(refName string) *RefAlreadyExistsError {
	return &RefAlreadyExistsError{
		RefName: refName,
	}
}

// AuthorError provides structured information about invalid author information.
type AuthorError struct {
	Field  string
	Reason string
}

func (e *AuthorError) Error() string {
	return fmt.Sprintf("invalid author %s: %s", e.Field, e.Reason)
}

func (e *AuthorError) Unwrap() error {
	return ErrInvalidAuthor
}

// NewAuthorError creates a new AuthorError with the specified details.
func NewAuthorError(field, reason string) *AuthorError {
	return &AuthorError{
		Field:  field,
		Reason: reason,
	}
}
