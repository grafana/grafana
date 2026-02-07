package storagewrappers

import (
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/internal/shared"
	"github.com/openfga/openfga/internal/utils/apimethod"
	"github.com/openfga/openfga/pkg/server/config"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/storagewrappers/sharediterator"
)

type OperationType int

type Operation struct {
	Method            apimethod.APIMethod
	Concurrency       uint32
	ThrottlingEnabled bool
	ThrottleThreshold int
	ThrottleDuration  time.Duration
}

// RequestStorageWrapper uses the decorator pattern to wrap a RelationshipTupleReader with various functionalities,
// which includes exposing metrics.
type RequestStorageWrapper struct {
	storage.RelationshipTupleReader
	StorageInstrumentation
}

type DataResourceConfiguration struct {
	Resources      *shared.SharedDatastoreResources
	CacheSettings  config.CacheSettings
	UseShadowCache bool
}

var _ StorageInstrumentation = (*RequestStorageWrapper)(nil)

// NewRequestStorageWrapperWithCache wraps the existing datastore to enable caching of iterators.
func NewRequestStorageWrapperWithCache(
	ds storage.RelationshipTupleReader,
	requestContextualTuples []*openfgav1.TupleKey,
	op *Operation,
	dataResourceConfiguration DataResourceConfiguration,
) *RequestStorageWrapper {
	instrumented := NewBoundedTupleReader(ds, op) // to rate-limit reads
	var tupleReader storage.RelationshipTupleReader
	tupleReader = instrumented
	if op.Method == apimethod.Check && dataResourceConfiguration.CacheSettings.ShouldCacheCheckIterators() {
		// Reads tuples from cache where possible
		tupleReader = NewCachedDatastore(
			dataResourceConfiguration.Resources.ServerCtx,
			tupleReader,
			dataResourceConfiguration.Resources.CheckCache,
			int(dataResourceConfiguration.CacheSettings.CheckIteratorCacheMaxResults),
			dataResourceConfiguration.CacheSettings.CheckIteratorCacheTTL,
			dataResourceConfiguration.Resources.SingleflightGroup,
			dataResourceConfiguration.Resources.WaitGroup,
			WithCachedDatastoreLogger(dataResourceConfiguration.Resources.Logger),
			WithCachedDatastoreMethodName(string(op.Method)),
		)
	} else if op.Method == apimethod.ListObjects && dataResourceConfiguration.CacheSettings.ShouldCacheListObjectsIterators() {
		checkCache := dataResourceConfiguration.Resources.CheckCache
		if dataResourceConfiguration.UseShadowCache {
			checkCache = dataResourceConfiguration.Resources.ShadowCheckCache
		}
		tupleReader = NewCachedDatastore(
			dataResourceConfiguration.Resources.ServerCtx,
			tupleReader,
			checkCache,
			int(dataResourceConfiguration.CacheSettings.ListObjectsIteratorCacheMaxResults),
			dataResourceConfiguration.CacheSettings.ListObjectsIteratorCacheTTL,
			dataResourceConfiguration.Resources.SingleflightGroup,
			dataResourceConfiguration.Resources.WaitGroup,
			WithCachedDatastoreLogger(dataResourceConfiguration.Resources.Logger),
			WithCachedDatastoreMethodName(string(op.Method)),
		)
	}
	if dataResourceConfiguration.CacheSettings.SharedIteratorEnabled {
		tupleReader = sharediterator.NewSharedIteratorDatastore(tupleReader, dataResourceConfiguration.Resources.SharedIteratorStorage,
			sharediterator.WithSharedIteratorDatastoreLogger(dataResourceConfiguration.Resources.Logger),
			sharediterator.WithMethod(string(op.Method)))
	}
	combinedTupleReader := NewCombinedTupleReader(tupleReader, requestContextualTuples) // to read the contextual tuples

	return &RequestStorageWrapper{
		RelationshipTupleReader: combinedTupleReader,
		StorageInstrumentation:  instrumented,
	}
}

// NewRequestStorageWrapper is used for ListUsers.
func NewRequestStorageWrapper(ds storage.RelationshipTupleReader, requestContextualTuples []*openfgav1.TupleKey, op *Operation) *RequestStorageWrapper {
	instrumented := NewBoundedTupleReader(ds, op)
	return &RequestStorageWrapper{
		RelationshipTupleReader: NewCombinedTupleReader(instrumented, requestContextualTuples),
		StorageInstrumentation:  instrumented,
	}
}

func (s *RequestStorageWrapper) GetMetadata() Metadata {
	return s.StorageInstrumentation.GetMetadata()
}
