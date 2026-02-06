//go:generate mockgen -source interface.go -destination ./mock_check_resolver.go -package graph CheckResolver

package graph

import (
	"context"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
)

type CheckResolverCloser func()

type CheckResolver interface {
	// ResolveCheck resolves a node (a single subproblem) out of a tree of problems.
	// If the depth of the tree has gotten too large, resolution is aborted and an error must be returned.
	//
	// It is expected that callers pass in, contextually:
	// - a [[storage.RelationshipTupleReader]] using [[storage.ContextWithRelationshipTupleReader]]. This is by design because this method is called by
	// [[server.Check]], but each time it is called there are invariants that must be met that relate
	// to the concurrency of the underlying RelationshipTupleReader as well as contextual tuples per
	// parent request.
	// - a [[Typesystem]]. Some implementations may panic if this isn't set.
	//
	// ResolveCheck is a recursive function. The first call to this function must be the "parent" problem to solve,
	// and recursive calls solve the child subproblems (which may be overlapping).
	//
	// Implementations must pass along the request in full, with all its fields,
	// and it must set the response in full, including the metadata, with any updates necessary.
	//
	// The return values may be nil and an error, or non-nil and an error.
	ResolveCheck(ctx context.Context, req *ResolveCheckRequest) (*ResolveCheckResponse, error)

	// Close releases resources. It must be called after the CheckResolver is done processing all requests.
	Close()

	// SetDelegate sets the next resolver in the chain. It can be the same resolver,
	// but a call to Delegate.ResolveCheck must not create infinite recursion.
	SetDelegate(delegate CheckResolver)

	GetDelegate() CheckResolver
}

type CheckRewriteResolver interface {
	CheckResolver

	CheckRewrite(ctx context.Context, req *ResolveCheckRequest, rewrite *openfgav1.Userset) CheckHandlerFunc
}
