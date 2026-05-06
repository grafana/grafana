package storage

import (
	"context"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

type ctxKey string

const (
	// DefaultMaxTuplesPerWrite specifies the default maximum number of tuples that can be written
	// in a single write operation. This constant is used to limit the batch size in write operations
	// to maintain performance and avoid overloading the system. The value is set to 100 tuples,
	// which is a balance between efficiency and resource usage.
	DefaultMaxTuplesPerWrite = 100

	// DefaultMaxTypesPerAuthorizationModel defines the default upper limit on the number of distinct
	// types that can be included in a single authorization model. This constraint helps in managing
	// the complexity and ensuring the maintainability of the authorization models. The limit is
	// set to 100 types, providing ample flexibility while keeping the model manageable.
	DefaultMaxTypesPerAuthorizationModel = 100

	// DefaultPageSize sets the default number of items to be returned in a single page when paginating
	// through a set of results. This constant is used to standardize the pagination size across various
	// parts of the system, ensuring a consistent and manageable volume of data per page. The default
	// value is set to 50, balancing detail per page with the overall number of pages.
	DefaultPageSize = 50

	relationshipTupleReaderCtxKey ctxKey = "relationship-tuple-reader-context-key"
)

// ContextWithRelationshipTupleReader sets the provided [[RelationshipTupleReader]]
// in the context. The context returned is a new context derived from the parent
// context provided.
func ContextWithRelationshipTupleReader(
	parent context.Context,
	reader RelationshipTupleReader,
) context.Context {
	return context.WithValue(parent, relationshipTupleReaderCtxKey, reader)
}

// RelationshipTupleReaderFromContext extracts a [[RelationshipTupleReader]] from the
// provided context (if any). If no such value is in the context a boolean false is returned,
// otherwise the RelationshipTupleReader is returned.
func RelationshipTupleReaderFromContext(ctx context.Context) (RelationshipTupleReader, bool) {
	ctxValue := ctx.Value(relationshipTupleReaderCtxKey)

	reader, ok := ctxValue.(RelationshipTupleReader)
	return reader, ok
}

// PaginationOptions should not be instantiated directly. Use NewPaginationOptions.
type PaginationOptions struct {
	PageSize int
	// From is a continuation token that can be used to retrieve the next page of results. Its contents will depend on the API.
	From string
}

// NewPaginationOptions creates a new [PaginationOptions] instance
// with a specified page size and continuation token. If the input page size is empty,
// it uses DefaultPageSize.
// The continuation token is used to retrieve the next page of results, OR the first page based on start time.
func NewPaginationOptions(ps int32, contToken string) PaginationOptions {
	pageSize := DefaultPageSize
	if ps > 0 {
		pageSize = int(ps)
	}

	return PaginationOptions{
		PageSize: pageSize,
		From:     contToken,
	}
}

// ReadAuthorizationModelOptions represents the options that can
// be used with the ReadAuthorizationModels method.
type ReadAuthorizationModelsOptions struct {
	Pagination PaginationOptions
}

// ListStoresOptions represents the options that can
// be used with the ListStores method.
type ListStoresOptions struct {
	// IDs is a list of store IDs to filter the results.
	IDs []string
	// Name is used to filter the results. If left empty no filter is applied.
	Name       string
	Pagination PaginationOptions
}

// ReadChangesOptions represents the options that can
// be used with the ReadChanges method.
type ReadChangesOptions struct {
	Pagination PaginationOptions
	SortDesc   bool
}

// ReadPageOptions represents the options that can
// be used with the ReadPage method.
type ReadPageOptions struct {
	Pagination  PaginationOptions
	Consistency ConsistencyOptions
}

// ConsistencyOptions represents the options that can
// be used for methods that accept a consistency preference.
type ConsistencyOptions struct {
	Preference openfgav1.ConsistencyPreference
}

// ReadOptions represents the options that can
// be used with the Read method.
type ReadOptions struct {
	Consistency ConsistencyOptions
}

// ReadUserTupleOptions represents the options that can
// be used with the ReadUserTuple method.
type ReadUserTupleOptions struct {
	Consistency ConsistencyOptions
}

// ReadUsersetTuplesOptions represents the options that can
// be used with the ReadUsersetTuples method.
type ReadUsersetTuplesOptions struct {
	Consistency ConsistencyOptions
}

// ReadStartingWithUserOptions represents the options that can
// be used with the ReadStartingWithUser method.
type ReadStartingWithUserOptions struct {
	Consistency                ConsistencyOptions
	WithResultsSortedAscending bool
}

// Writes is a typesafe alias for Write arguments.
type Writes = []*openfgav1.TupleKey

// Deletes is a typesafe alias for Delete arguments.
type Deletes = []*openfgav1.TupleKeyWithoutCondition

// A TupleBackend provides a read/write interface for managing tuples.
type TupleBackend interface {
	RelationshipTupleReader
	RelationshipTupleWriter
}

// RelationshipTupleReader is an interface that defines the set of
// methods required to read relationship tuples from a data store.
type RelationshipTupleReader interface {
	// Read the set of tuples associated with `store` and `tupleKey`, which may be nil or partially filled. If nil,
	// Read will return an iterator over all the tuples in the given `store`. If the `tupleKey` is partially filled,
	// it will return an iterator over those tuples which match the `tupleKey`. Note that at least one of `Object`
	// or `User` (or both), must be specified in this case.
	//
	// The caller must be careful to close the [TupleIterator], either by consuming the entire iterator or by closing it.
	// There is NO guarantee on the order of the tuples returned on the iterator.
	Read(ctx context.Context, store string, filter ReadFilter, options ReadOptions) (TupleIterator, error)

	// ReadPage functions similarly to Read but includes support for pagination. It takes
	// mandatory ReadPageOptions options. PageSize will always be greater than zero.
	// It returns a slice of tuples along with a continuation token. This token can be used for retrieving subsequent pages of data.
	// There is NO guarantee on the order of the tuples in one page.
	ReadPage(ctx context.Context, store string, filter ReadFilter, options ReadPageOptions) ([]*openfgav1.Tuple, string, error)

	// ReadUserTuple tries to return one tuple that matches the provided key exactly.
	// If none is found, it must return [ErrNotFound].
	ReadUserTuple(
		ctx context.Context,
		store string,
		filter ReadUserTupleFilter,
		options ReadUserTupleOptions,
	) (*openfgav1.Tuple, error)

	// ReadUsersetTuples returns all userset tuples for a specified object and relation.
	// For example, given the following relationship tuples:
	//	document:doc1, viewer, user:*
	//	document:doc1, viewer, group:eng#member
	// and the filter
	//	object=document:1, relation=viewer, allowedTypesForUser=[group#member]
	// this method would return the tuple (document:doc1, viewer, group:eng#member)
	// If allowedTypesForUser is empty, both tuples would be returned.
	// There is NO guarantee on the order returned on the iterator.
	ReadUsersetTuples(
		ctx context.Context,
		store string,
		filter ReadUsersetTuplesFilter,
		options ReadUsersetTuplesOptions,
	) (TupleIterator, error)

	// ReadStartingWithUser performs a reverse read of relationship tuples starting at one or
	// more user(s) or userset(s) and filtered by object type and relation and possibly a list of object IDs.
	//
	// For example, given the following relationship tuples:
	//   document:doc1, viewer, user:jon
	//   document:doc2, viewer, group:eng#member
	//   document:doc3, editor, user:jon
	//   document:doc4, viewer, group:eng#member
	//
	// ReadStartingWithUser for ['user:jon', 'group:eng#member'] filtered by 'document#viewer'
	// and 'document:doc1, document:doc2' would
	// return ['document:doc1#viewer@user:jon', 'document:doc2#viewer@group:eng#member'].
	// If ReadStartingWithUserOptions.WithResultsSortedAscending bool is enabled, the tuples returned must be sorted by one or more fields in them.
	ReadStartingWithUser(
		ctx context.Context,
		store string,
		filter ReadStartingWithUserFilter,
		options ReadStartingWithUserOptions,
	) (TupleIterator, error)
}

// OnMissingDelete defines the behavior of delete operation when the tuple to be deleted does not exist.
type OnMissingDelete int32

// OnDuplicateInsert defines the behavior of insert operation when the tuple to be inserted already exists.
type OnDuplicateInsert int32

const (
	// OnMissingDeleteError indicates that if a delete operation is attempted on a tuple that does
	// not exist, an error should be returned.
	OnMissingDeleteError OnMissingDelete = 0

	// OnMissingDeleteIgnore indicates that if a delete operation is attempted on a tuple that does
	// not exist, it should be ignored as no-op and no error should be returned.
	OnMissingDeleteIgnore OnMissingDelete = 1

	// OnDuplicateInsertError indicates that if an insert operation is attempted on a tuple that already exists,
	// an error should be returned.
	OnDuplicateInsertError OnDuplicateInsert = 0

	// OnDuplicateInsertIgnore indicates that if an insert operation is attempted on a tuple that already exists,
	// it should be ignored as a no-op and no error should be returned.
	OnDuplicateInsertIgnore OnDuplicateInsert = 1
)

// TupleWriteOptions defines the options that can be used when writing tuples.
// It allows customization of the behavior when a delete operation is attempted on a tuple that does not
// exist, or when an insert operation is attempted on a tuple that already exists.
type TupleWriteOptions struct {
	OnMissingDelete   OnMissingDelete
	OnDuplicateInsert OnDuplicateInsert
}

type TupleWriteOption func(*TupleWriteOptions)

func WithOnMissingDelete(onMissingDelete OnMissingDelete) TupleWriteOption {
	return func(opts *TupleWriteOptions) {
		opts.OnMissingDelete = onMissingDelete
	}
}

func WithOnDuplicateInsert(onDuplicateInsert OnDuplicateInsert) TupleWriteOption {
	return func(opts *TupleWriteOptions) {
		opts.OnDuplicateInsert = onDuplicateInsert
	}
}

func NewTupleWriteOptions(opts ...TupleWriteOption) TupleWriteOptions {
	res := TupleWriteOptions{
		OnMissingDelete:   OnMissingDeleteError,
		OnDuplicateInsert: OnDuplicateInsertError,
	}
	for _, opt := range opts {
		opt(&res)
	}
	return res
}

// RelationshipTupleWriter is an interface that defines the set of methods
// required for writing relationship tuples in a data store.
type RelationshipTupleWriter interface {
	// Write updates data in the tuple backend, performing all delete operations in
	// `deletes` before adding new values in `writes`.
	// It must also write to the changelog.
	// If two concurrent requests attempt to write the same tuple at the same time, it must return ErrTransactionalWriteFailed. TODO write test
	// If the tuple to be written already existed or the tuple to be deleted didn't exist, it must return InvalidWriteInputError. TODO write test
	// opts are optional and can be used to customize the behavior of the write operation.
	Write(ctx context.Context, store string, d Deletes, w Writes, opts ...TupleWriteOption) error

	// MaxTuplesPerWrite returns the maximum number of items (writes and deletes combined)
	// allowed in a single write transaction.
	MaxTuplesPerWrite() int
}

// ReadStartingWithUserFilter specifies the filter options that will be used
// to constrain the [RelationshipTupleReader.ReadStartingWithUser] query.
type ReadStartingWithUserFilter struct {
	// Mandatory.
	ObjectType string
	// Mandatory.
	Relation string
	// Mandatory.
	UserFilter []*openfgav1.ObjectRelation

	// Optional. It can be nil. If present, it will be sorted in ascending order.
	// The datastore should return the intersection between this filter and what is in the database.
	ObjectIDs SortedSet

	// Optional. It can be nil. If present, it will be used to filter the results. Conditions can hold the empty value
	Conditions []string
}

// ReadFilter specifies the filter options that will be used
// to constrain the [RelationshipTupleReader.ReadFilter] query.
type ReadFilter struct {
	// Mandatory.
	Object string
	// Mandatory.
	Relation string
	// Mandatory.
	User string

	// Optional. It can be nil. If present, it will be used to filter the results. Conditions can hold the empty value
	Conditions []string
}

// ReadUserTupleFilter specifies the filter options that will be used
// to constrain the [RelationshipTupleReader.ReadUserTupleFilter] query.
type ReadUserTupleFilter = ReadFilter

// ReadUsersetTuplesFilter specifies the filter options that
// will be used to constrain the ReadUsersetTuples query.
type ReadUsersetTuplesFilter struct {
	Object                      string                         // Required.
	Relation                    string                         // Required.
	AllowedUserTypeRestrictions []*openfgav1.RelationReference // Optional.
	Conditions                  []string                       // Optional. It can be nil. If present, it will be used to filter the results. Conditions can hold the empty value.
}

// AuthorizationModelReadBackend provides a read interface for managing type definitions.
type AuthorizationModelReadBackend interface {
	// ReadAuthorizationModel reads the model corresponding to store and model ID.
	// If it's not found, or if the model has zero types, it must return ErrNotFound.
	ReadAuthorizationModel(ctx context.Context, store string, id string) (*openfgav1.AuthorizationModel, error)

	// ReadAuthorizationModels reads all models for the supplied store and returns them in descending order of ULID (from newest to oldest).
	// In addition to the models, it returns a continuation token that can be used to fetch the next page of results.
	ReadAuthorizationModels(ctx context.Context, store string, options ReadAuthorizationModelsOptions) ([]*openfgav1.AuthorizationModel, string, error)

	// FindLatestAuthorizationModel returns the last model for the store.
	// If none were ever written, it must return ErrNotFound.
	FindLatestAuthorizationModel(ctx context.Context, store string) (*openfgav1.AuthorizationModel, error)
}

// TypeDefinitionWriteBackend provides a write interface for managing typed definition.
type TypeDefinitionWriteBackend interface {
	// MaxTypesPerAuthorizationModel returns the maximum number of type definition rows/items per model.
	MaxTypesPerAuthorizationModel() int

	// WriteAuthorizationModel writes an authorization model for the given store.
	// If the model has zero types, the datastore may choose to do nothing and return no error.
	WriteAuthorizationModel(ctx context.Context, store string, model *openfgav1.AuthorizationModel) error
}

// AuthorizationModelBackend provides an read/write interface for managing models and their type definitions.
type AuthorizationModelBackend interface {
	AuthorizationModelReadBackend
	TypeDefinitionWriteBackend
}

type StoresBackend interface {
	// CreateStore must return an error if the store ID or the name aren't set. TODO write test.
	// If the store ID already existed it must return ErrCollision.
	CreateStore(ctx context.Context, store *openfgav1.Store) (*openfgav1.Store, error)

	// DeleteStore must delete the store by either setting its DeletedAt field or removing the entry.
	DeleteStore(ctx context.Context, id string) error

	// GetStore must return ErrNotFound if the store is not found or its DeletedAt is set.
	GetStore(ctx context.Context, id string) (*openfgav1.Store, error)

	// ListStores returns a list of non-deleted stores that match the provided options.
	// In addition to the stores, it returns a continuation token that can be used to fetch the next page of results.
	// If no stores are found, it is expected to return an empty list and an empty continuation token.
	ListStores(ctx context.Context, options ListStoresOptions) ([]*openfgav1.Store, string, error)
}

// AssertionsBackend is an interface that defines the set of methods for reading and writing assertions.
type AssertionsBackend interface {
	// WriteAssertions overwrites the assertions for a store and modelID.
	WriteAssertions(ctx context.Context, store, modelID string, assertions []*openfgav1.Assertion) error

	// ReadAssertions returns the assertions for a store and modelID.
	// If no assertions were ever written, it must return an empty list.
	ReadAssertions(ctx context.Context, store, modelID string) ([]*openfgav1.Assertion, error)
}

type ReadChangesFilter struct {
	ObjectType    string
	HorizonOffset time.Duration
}

// ChangelogBackend is an interface for interacting with and managing changelogs.
type ChangelogBackend interface {
	// ReadChanges returns the writes and deletes that have occurred for tuples within a store,
	// in the order that they occurred.
	// You can optionally provide a filter to filter out changes for objects of a specific type.
	// The horizonOffset should be specified using a unit no more granular than a millisecond.
	// It should always return a ULID as a continuation token so readers can continue reading later, except the case where
	// if no changes are found, it should return storage.ErrNotFound and an empty continuation token.
	// It's important that the continuation token is a ULID, so it could be generated from timestamp.
	ReadChanges(ctx context.Context, store string, filter ReadChangesFilter, options ReadChangesOptions) ([]*openfgav1.TupleChange, string, error)
}

// OpenFGADatastore is an interface that defines a set of methods for interacting
// with and managing data in an OpenFGA (Fine-Grained Authorization) system.
type OpenFGADatastore interface {
	TupleBackend
	AuthorizationModelBackend
	StoresBackend
	AssertionsBackend
	ChangelogBackend

	// IsReady reports whether the datastore is ready to accept traffic.
	IsReady(ctx context.Context) (ReadinessStatus, error)

	// Close closes the datastore and cleans up any residual resources.
	Close()
}

// ReadinessStatus represents the readiness status of the datastore.
type ReadinessStatus struct {
	// Message is a human-friendly status message for the current datastore status.
	Message string

	IsReady bool
}
