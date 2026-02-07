// Package graph contains code related to evaluation of authorization models through graph traversals.
package graph

import (
	"context"
	"errors"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"
)

type ctxKey string

const (
	resolutionDepthCtxKey ctxKey = "resolution-depth"
)

var (
	ErrResolutionDepthExceeded = errors.New("resolution depth exceeded")
)

type findEdgeOption int

const (
	resolveAllEdges findEdgeOption = iota
	resolveAnyEdge
)

// ContextWithResolutionDepth attaches the provided graph resolution depth to the parent context.
func ContextWithResolutionDepth(parent context.Context, depth uint32) context.Context {
	return context.WithValue(parent, resolutionDepthCtxKey, depth)
}

// ResolutionDepthFromContext returns the current graph resolution depth from the provided context (if any).
func ResolutionDepthFromContext(ctx context.Context) (uint32, bool) {
	depth, ok := ctx.Value(resolutionDepthCtxKey).(uint32)
	return depth, ok
}

type RelationshipEdgeType int

const (
	// DirectEdge defines a direct connection between a source object reference
	// and some target user reference.
	DirectEdge RelationshipEdgeType = iota
	// TupleToUsersetEdge defines a connection between a source object reference
	// and some target user reference that is co-dependent upon the lookup of a third object reference.
	TupleToUsersetEdge
	// ComputedUsersetEdge defines a direct connection between a source object reference
	// and some target user reference. The difference with DirectEdge is that DirectEdge will involve
	// a read of tuples and this one will not.
	ComputedUsersetEdge
)

func (r RelationshipEdgeType) String() string {
	switch r {
	case DirectEdge:
		return "direct"
	case ComputedUsersetEdge:
		return "computed_userset"
	case TupleToUsersetEdge:
		return "ttu"
	default:
		return "undefined"
	}
}

type EdgeCondition int

// RelationshipEdge represents a possible relationship between some source object reference
// and a target user reference. The possibility is realized depending on the tuples and on the edge's type.
type RelationshipEdge struct {
	Type RelationshipEdgeType

	// The edge is directed towards this node, which can be like group:*, or group, or group:member
	TargetReference *openfgav1.RelationReference

	// If the type is TupleToUsersetEdge, this defines the TTU condition
	TuplesetRelation string

	TargetReferenceInvolvesIntersectionOrExclusion bool
}

func (r RelationshipEdge) String() string {
	// TODO also print the condition
	var val string
	if r.TuplesetRelation != "" {
		val = fmt.Sprintf("userset %s, type %s, tupleset %s", r.TargetReference.String(), r.Type.String(), r.TuplesetRelation)
	} else {
		val = fmt.Sprintf("userset %s, type %s", r.TargetReference.String(), r.Type.String())
	}
	return strings.ReplaceAll(val, "  ", " ")
}

// RelationshipGraph represents a graph of relationships and the connectivity between
// object and relation references within the graph through direct or indirect relationships.
type RelationshipGraph struct {
	typesystem *typesystem.TypeSystem
}

// New returns a RelationshipGraph from an authorization model. The RelationshipGraph should be used to introspect what kind of relationships between
// object types can exist. To visualize this graph, use https://github.com/jon-whit/openfga-graphviz-gen
func New(typesystem *typesystem.TypeSystem) *RelationshipGraph {
	return &RelationshipGraph{
		typesystem: typesystem,
	}
}

// GetRelationshipEdges finds all paths from a source to a target and then returns all the edges at distance 0 or 1 of the source in those paths.
func (g *RelationshipGraph) GetRelationshipEdges(target *openfgav1.RelationReference, source *openfgav1.RelationReference) ([]*RelationshipEdge, error) {
	return g.getRelationshipEdges(target, source, map[string]struct{}{}, resolveAllEdges)
}

// GetPrunedRelationshipEdges finds all paths from a source to a target and then returns all the edges at distance 0 or 1 of the source in those paths.
// If the edges from the source to the target pass through a relationship involving intersection or exclusion (directly or indirectly),
// then GetPrunedRelationshipEdges will just return the first-most edge involved in that rewrite.
//
// Consider the following model:
//
// type user
// type document
//
//	relations
//	  define allowed: [user]
//	  define viewer: [user] and allowed
//
// The pruned relationship edges from the 'user' type to 'document#viewer' returns only the edge from 'user' to 'document#viewer' and with a 'RequiresFurtherEvalCondition'.
// This is because when evaluating relationships involving intersection or exclusion we choose to only evaluate one operand of the rewrite rule, and for each result found
// we call Check on the result to evaluate the sub-condition on the 'and allowed' bit.
func (g *RelationshipGraph) GetPrunedRelationshipEdges(target *openfgav1.RelationReference, source *openfgav1.RelationReference) ([]*RelationshipEdge, error) {
	return g.getRelationshipEdges(target, source, map[string]struct{}{}, resolveAnyEdge)
}

func (g *RelationshipGraph) getRelationshipEdges(
	target *openfgav1.RelationReference,
	source *openfgav1.RelationReference,
	visited map[string]struct{},
	findEdgeOption findEdgeOption,
) ([]*RelationshipEdge, error) {
	key := tuple.ToObjectRelationString(target.GetType(), target.GetRelation())
	if _, ok := visited[key]; ok {
		// We've already visited the target so no need to do so again.
		return nil, nil
	}
	visited[key] = struct{}{}

	relation, err := g.typesystem.GetRelation(target.GetType(), target.GetRelation())
	if err != nil {
		return nil, err
	}

	return g.getRelationshipEdgesWithTargetRewrite(
		target,
		source,
		relation.GetRewrite(),
		visited,
		findEdgeOption,
	)
}

// getRelationshipEdgesWithTargetRewrite does a BFS on the graph starting at `target` and trying to reach `source`.
func (g *RelationshipGraph) getRelationshipEdgesWithTargetRewrite(
	target *openfgav1.RelationReference,
	source *openfgav1.RelationReference,
	targetRewrite *openfgav1.Userset,
	visited map[string]struct{},
	findEdgeOption findEdgeOption,
) ([]*RelationshipEdge, error) {
	switch t := targetRewrite.GetUserset().(type) {
	case *openfgav1.Userset_This: // e.g. define viewer:[user]
		var res []*RelationshipEdge
		directlyRelated, _ := g.typesystem.IsDirectlyRelated(target, source)
		publiclyAssignable, _ := g.typesystem.IsPubliclyAssignable(target, source.GetType())

		if directlyRelated || publiclyAssignable {
			// if source=user, or define viewer:[user:*]
			res = append(res, &RelationshipEdge{
				Type:            DirectEdge,
				TargetReference: typesystem.DirectRelationReference(target.GetType(), target.GetRelation()),
				TargetReferenceInvolvesIntersectionOrExclusion: false,
			})
		}

		typeRestrictions, _ := g.typesystem.GetDirectlyRelatedUserTypes(target.GetType(), target.GetRelation())

		for _, typeRestriction := range typeRestrictions {
			if typeRestriction.GetRelation() != "" { // e.g. define viewer:[team#member]
				// recursively sub-collect any edges for (team#member, source)
				edges, err := g.getRelationshipEdges(typeRestriction, source, visited, findEdgeOption)
				if err != nil {
					return nil, err
				}

				res = append(res, edges...)
			}
		}

		return res, nil
	case *openfgav1.Userset_ComputedUserset: // e.g. target = define viewer: writer

		var edges []*RelationshipEdge

		// if source=document#writer
		sourceRelMatchesRewritten := target.GetType() == source.GetType() && t.ComputedUserset.GetRelation() == source.GetRelation()

		if sourceRelMatchesRewritten {
			edges = append(edges, &RelationshipEdge{
				Type:            ComputedUsersetEdge,
				TargetReference: typesystem.DirectRelationReference(target.GetType(), target.GetRelation()),
				TargetReferenceInvolvesIntersectionOrExclusion: false,
			})
		}

		collected, err := g.getRelationshipEdges(
			typesystem.DirectRelationReference(target.GetType(), t.ComputedUserset.GetRelation()),
			source,
			visited,
			findEdgeOption,
		)
		if err != nil {
			return nil, err
		}

		edges = append(
			edges,
			collected...,
		)
		return edges, nil
	case *openfgav1.Userset_TupleToUserset: // e.g. type document, define viewer: writer from parent
		tupleset := t.TupleToUserset.GetTupleset().GetRelation()               // parent
		computedUserset := t.TupleToUserset.GetComputedUserset().GetRelation() // writer

		var res []*RelationshipEdge
		// e.g. type document, define parent:[user, group]
		tuplesetTypeRestrictions, _ := g.typesystem.GetDirectlyRelatedUserTypes(target.GetType(), tupleset)

		for _, typeRestriction := range tuplesetTypeRestrictions {
			r, err := g.typesystem.GetRelation(typeRestriction.GetType(), computedUserset)
			if err != nil {
				if errors.Is(err, typesystem.ErrRelationUndefined) {
					continue
				}

				return nil, err
			}

			if typeRestriction.GetType() == source.GetType() && computedUserset == source.GetRelation() {
				involvesIntersection, err := g.typesystem.RelationInvolvesIntersection(typeRestriction.GetType(), r.GetName())
				if err != nil {
					return nil, err
				}

				involvesExclusion, err := g.typesystem.RelationInvolvesExclusion(typeRestriction.GetType(), r.GetName())
				if err != nil {
					return nil, err
				}

				res = append(res, &RelationshipEdge{
					Type:             TupleToUsersetEdge,
					TargetReference:  typesystem.DirectRelationReference(target.GetType(), target.GetRelation()),
					TuplesetRelation: tupleset,
					TargetReferenceInvolvesIntersectionOrExclusion: involvesIntersection || involvesExclusion,
				})
			}

			subResults, err := g.getRelationshipEdges(
				typesystem.DirectRelationReference(typeRestriction.GetType(), computedUserset),
				source,
				visited,
				findEdgeOption,
			)
			if err != nil {
				return nil, err
			}

			res = append(res, subResults...)
		}

		return res, nil
	case *openfgav1.Userset_Union: // e.g. target = define viewer: self or writer
		var res []*RelationshipEdge
		for _, child := range t.Union.GetChild() {
			// we recurse through each child rewrite
			childResults, err := g.getRelationshipEdgesWithTargetRewrite(target, source, child, visited, findEdgeOption)
			if err != nil {
				return nil, err
			}
			res = append(res, childResults...)
		}
		return res, nil
	case *openfgav1.Userset_Intersection:

		if findEdgeOption == resolveAnyEdge {
			child := t.Intersection.GetChild()[0]

			childresults, err := g.getRelationshipEdgesWithTargetRewrite(target, source, child, visited, findEdgeOption)
			if err != nil {
				return nil, err
			}

			for _, childresult := range childresults {
				childresult.TargetReferenceInvolvesIntersectionOrExclusion = true
			}

			return childresults, nil
		}

		var edges []*RelationshipEdge
		for _, child := range t.Intersection.GetChild() {
			res, err := g.getRelationshipEdgesWithTargetRewrite(target, source, child, visited, findEdgeOption)
			if err != nil {
				return nil, err
			}

			edges = append(edges, res...)
		}

		if len(edges) > 0 {
			edges[0].TargetReferenceInvolvesIntersectionOrExclusion = true
		}

		return edges, nil
	case *openfgav1.Userset_Difference:

		if findEdgeOption == resolveAnyEdge {
			// if we have 'a but not b', then we prune 'b' and only resolve 'a' with a
			// condition that requires further evaluation. It's more likely the blacklist
			// on 'but not b' is a larger set than the base set 'a', and so pruning the
			// subtracted set is generally going to be a better choice.

			child := t.Difference.GetBase()

			childresults, err := g.getRelationshipEdgesWithTargetRewrite(target, source, child, visited, findEdgeOption)
			if err != nil {
				return nil, err
			}

			for _, childresult := range childresults {
				childresult.TargetReferenceInvolvesIntersectionOrExclusion = true
			}

			return childresults, nil
		}

		var edges []*RelationshipEdge

		baseRewrite := t.Difference.GetBase()

		baseEdges, err := g.getRelationshipEdgesWithTargetRewrite(target, source, baseRewrite, visited, findEdgeOption)
		if err != nil {
			return nil, err
		}

		if len(baseEdges) > 0 {
			baseEdges[0].TargetReferenceInvolvesIntersectionOrExclusion = true
		}

		edges = append(edges, baseEdges...)

		subtractRewrite := t.Difference.GetSubtract()

		subEdges, err := g.getRelationshipEdgesWithTargetRewrite(target, source, subtractRewrite, visited, findEdgeOption)
		if err != nil {
			return nil, err
		}
		edges = append(edges, subEdges...)

		return edges, nil
	default:
		panic("unexpected userset rewrite encountered")
	}
}
