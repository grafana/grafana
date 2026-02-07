package graph

import (
	"errors"
	"strings"
	"sync/atomic"
	"time"

	"golang.org/x/exp/maps"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/storage"
)

type ResolveCheckRequest struct {
	StoreID                   string
	AuthorizationModelID      string // TODO replace with typesystem
	TupleKey                  *openfgav1.TupleKey
	ContextualTuples          []*openfgav1.TupleKey
	Context                   *structpb.Struct
	RequestMetadata           *ResolveCheckRequestMetadata
	VisitedPaths              map[string]struct{}
	Consistency               openfgav1.ConsistencyPreference
	LastCacheInvalidationTime time.Time

	// Invariant parts of a check request are those that don't change in sub-problems
	// AuthorizationModelID, StoreID, Context, and ContextualTuples.
	// the invariantCacheKey is computed once per request, and passed to sub-problems via copy in .clone()
	invariantCacheKey string
}

type ResolveCheckRequestMetadata struct {
	// Thinking of a Check as a tree of evaluations,
	// Depth is the current level in the tree in the current path that we are exploring.
	// When we jump one level, we increment it by 1. If it hits maxResolutionDepth (resolveNodeLimit), we throw ErrResolutionDepthExceeded.
	Depth uint32

	// DispatchCounter is the address to a shared counter that keeps track of how many calls to ResolveCheck we had to do
	// to solve the root/parent problem.
	// The contents of this counter will be written by concurrent goroutines.
	// After the root problem has been solved, this value can be read.
	DispatchCounter *atomic.Uint32

	// WasThrottled indicates whether the request was throttled
	WasThrottled *atomic.Bool
}

type ResolveCheckRequestParams struct {
	StoreID                   string
	TupleKey                  *openfgav1.TupleKey
	ContextualTuples          []*openfgav1.TupleKey
	Context                   *structpb.Struct
	Consistency               openfgav1.ConsistencyPreference
	LastCacheInvalidationTime time.Time
	AuthorizationModelID      string
}

func NewCheckRequestMetadata() *ResolveCheckRequestMetadata {
	return &ResolveCheckRequestMetadata{
		DispatchCounter: new(atomic.Uint32),
		WasThrottled:    new(atomic.Bool),
	}
}

func NewResolveCheckRequest(
	params ResolveCheckRequestParams,
) (*ResolveCheckRequest, error) {
	if params.AuthorizationModelID == "" {
		return nil, errors.New("missing authorization_model_id")
	}

	if params.StoreID == "" {
		return nil, errors.New("missing store_id")
	}

	r := &ResolveCheckRequest{
		StoreID:              params.StoreID,
		AuthorizationModelID: params.AuthorizationModelID,
		TupleKey:             params.TupleKey,
		ContextualTuples:     params.ContextualTuples,
		Context:              params.Context,
		VisitedPaths:         make(map[string]struct{}),
		RequestMetadata:      NewCheckRequestMetadata(),
		Consistency:          params.Consistency,
		// avoid having to read from cache consistently by propagating it
		LastCacheInvalidationTime: params.LastCacheInvalidationTime,
	}

	keyBuilder := &strings.Builder{}
	err := storage.WriteInvariantCheckCacheKey(keyBuilder, &storage.CheckCacheKeyParams{
		StoreID:              params.StoreID,
		AuthorizationModelID: params.AuthorizationModelID,
		ContextualTuples:     params.ContextualTuples,
		Context:              params.Context,
	})
	if err != nil {
		return nil, err
	}

	r.invariantCacheKey = keyBuilder.String()

	return r, nil
}

func (r *ResolveCheckRequest) clone() *ResolveCheckRequest {
	var requestMetadata *ResolveCheckRequestMetadata
	origRequestMetadata := r.GetRequestMetadata()
	if origRequestMetadata != nil {
		requestMetadata = &ResolveCheckRequestMetadata{
			DispatchCounter: origRequestMetadata.DispatchCounter,
			Depth:           origRequestMetadata.Depth,
			WasThrottled:    origRequestMetadata.WasThrottled,
		}
	}

	var tupleKey *openfgav1.TupleKey
	if origTupleKey := r.GetTupleKey(); origTupleKey != nil {
		tupleKey = proto.Clone(origTupleKey).(*openfgav1.TupleKey)
	}

	return &ResolveCheckRequest{
		StoreID:                   r.GetStoreID(),
		AuthorizationModelID:      r.GetAuthorizationModelID(),
		TupleKey:                  tupleKey,
		ContextualTuples:          r.GetContextualTuples(),
		Context:                   r.GetContext(),
		RequestMetadata:           requestMetadata,
		VisitedPaths:              maps.Clone(r.GetVisitedPaths()),
		Consistency:               r.GetConsistency(),
		LastCacheInvalidationTime: r.GetLastCacheInvalidationTime(),
		invariantCacheKey:         r.GetInvariantCacheKey(),
	}
}

func (r *ResolveCheckRequest) GetStoreID() string {
	if r == nil {
		return ""
	}
	return r.StoreID
}

func (r *ResolveCheckRequest) GetAuthorizationModelID() string {
	if r == nil {
		return ""
	}
	return r.AuthorizationModelID
}

func (r *ResolveCheckRequest) GetTupleKey() *openfgav1.TupleKey {
	if r == nil {
		return nil
	}
	return r.TupleKey
}

func (r *ResolveCheckRequest) GetContextualTuples() []*openfgav1.TupleKey {
	if r == nil {
		return nil
	}
	return r.ContextualTuples
}

func (r *ResolveCheckRequest) GetRequestMetadata() *ResolveCheckRequestMetadata {
	if r == nil {
		return nil
	}
	return r.RequestMetadata
}

func (r *ResolveCheckRequest) GetContext() *structpb.Struct {
	if r == nil {
		return nil
	}
	return r.Context
}

func (r *ResolveCheckRequest) GetConsistency() openfgav1.ConsistencyPreference {
	if r == nil {
		return openfgav1.ConsistencyPreference_UNSPECIFIED
	}
	return r.Consistency
}

func (r *ResolveCheckRequest) GetVisitedPaths() map[string]struct{} {
	if r == nil {
		return map[string]struct{}{}
	}
	return r.VisitedPaths
}

func (r *ResolveCheckRequest) GetLastCacheInvalidationTime() time.Time {
	if r == nil {
		return time.Time{}
	}
	return r.LastCacheInvalidationTime
}

func (r *ResolveCheckRequest) GetInvariantCacheKey() string {
	if r == nil {
		return ""
	}
	return r.invariantCacheKey
}
