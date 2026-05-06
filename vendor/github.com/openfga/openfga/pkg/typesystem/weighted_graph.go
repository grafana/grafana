package typesystem

import (
	"fmt"
	"math"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/language/pkg/go/graph"

	"github.com/openfga/openfga/pkg/tuple"
)

type weightedGraphItem interface {
	GetWeight(destinationType string) (int, bool)
}

// hasPathTo returns a boolean indicating if a path exists from a node or edge to a terminal type. E.g
// can we reach "user" from "document".
func hasPathTo(nodeOrEdge weightedGraphItem, destinationType string) bool {
	_, ok := nodeOrEdge.GetWeight(destinationType)
	return ok
}

type IntersectionEdges struct {
	LowestEdge   *graph.WeightedAuthorizationModelEdge   // lowest edge to apply list objects
	SiblingEdges []*graph.WeightedAuthorizationModelEdge // the rest of the edges to apply intersection
}

type ExclusionEdges struct {
	BaseEdge     *graph.WeightedAuthorizationModelEdge // base edge to apply list objects
	ExcludedEdge *graph.WeightedAuthorizationModelEdge // excluded edge to apply exclusion
}

// GetEdgesForIntersection returns the lowest weighted edge and
// its siblings edges for intersection based via the weighted graph.
// If the direct edges have equal weight as its sibling edges, it will choose
// the direct edges as preference.
// If any of the children are not connected, it will return empty IntersectionEdges.
func GetEdgesForIntersection(edges []*graph.WeightedAuthorizationModelEdge, sourceType string) (IntersectionEdges, error) {
	if len(edges) < 2 {
		// Intersection by definition must have at least 2 children
		return IntersectionEdges{}, fmt.Errorf("invalid edges for source type %s", sourceType)
	}

	// Find the group with the lowest maximum weight
	lowestWeight := math.MaxInt32
	var lowestEdge *graph.WeightedAuthorizationModelEdge
	siblingEdges := make([]*graph.WeightedAuthorizationModelEdge, 0, len(edges))

	for _, edge := range edges {
		weight, _ := edge.GetWeight(sourceType)
		// get the max weight of the grouping
		if weight < lowestWeight {
			if lowestEdge != nil {
				siblingEdges = append(siblingEdges, lowestEdge)
			}
			lowestWeight = weight
			lowestEdge = edge
		} else {
			siblingEdges = append(siblingEdges, edge)
		}
	}

	return IntersectionEdges{
		LowestEdge:   lowestEdge,
		SiblingEdges: siblingEdges,
	}, nil
}

// GetEdgesForExclusion returns the base edges (i.e., edge A in "A but not B") and
// excluded edge (edge B in "A but not B") based on weighted graph for exclusion.
func GetEdgesForExclusion(
	edges []*graph.WeightedAuthorizationModelEdge,
	sourceType string,
) (ExclusionEdges, error) {
	if len(edges) != 2 {
		return ExclusionEdges{}, fmt.Errorf("invalid number of edges in an exclusion operation: expected 2, got %d", len(edges))
	}

	if !hasPathTo(edges[0], sourceType) {
		return ExclusionEdges{}, fmt.Errorf("the base edge does not have a path to the source type %s", sourceType)
	}

	baseEdge := edges[0]
	excludedEdge := edges[1]
	if !hasPathTo(excludedEdge, sourceType) {
		excludedEdge = nil
	}

	return ExclusionEdges{
		BaseEdge:     baseEdge,
		ExcludedEdge: excludedEdge,
	}, nil
}

// ConstructUserset returns the openfgav1.Userset to run CheckRewrite against list objects candidate when
// model has intersection / exclusion.
func (t *TypeSystem) ConstructUserset(currentEdge *graph.WeightedAuthorizationModelEdge, sourceUserType string) (*openfgav1.Userset, error) {
	currentNode := currentEdge.GetTo()
	edgeType := currentEdge.GetEdgeType()
	uniqueLabel := currentNode.GetUniqueLabel()

	switch currentNode.GetNodeType() {
	case graph.SpecificType, graph.SpecificTypeWildcard, graph.LogicalDirectGrouping:
		return This(), nil
	case graph.LogicalTTUGrouping:
		edges, err := t.GetEdgesFromNode(currentNode, sourceUserType)
		if err != nil {
			return nil, fmt.Errorf("failed to get edges from node %s: %w", currentNode.GetUniqueLabel(), err)
		}
		if len(edges) == 0 {
			return nil, fmt.Errorf("no edges found for node %s", currentNode.GetUniqueLabel())
		}
		// we just need to get the ttu information out of the first edge of the ttu logical group as the all belong to the same ttu definition
		return t.ConstructUserset(edges[0], sourceUserType)
	case graph.SpecificTypeAndRelation:
		switch edgeType {
		case graph.DirectEdge:
			// userset use case
			return This(), nil
		case graph.RewriteEdge, graph.ComputedEdge:
			_, relation := tuple.SplitObjectRelation(uniqueLabel)
			return &openfgav1.Userset{
				Userset: &openfgav1.Userset_ComputedUserset{
					ComputedUserset: &openfgav1.ObjectRelation{
						Relation: relation,
					},
				},
			}, nil
		case graph.TTUEdge:
			_, parent := tuple.SplitObjectRelation(currentEdge.GetTuplesetRelation())
			_, relation := tuple.SplitObjectRelation(uniqueLabel)
			return &openfgav1.Userset{
				Userset: &openfgav1.Userset_TupleToUserset{
					TupleToUserset: &openfgav1.TupleToUserset{
						Tupleset: &openfgav1.ObjectRelation{
							Relation: parent, // parent
						},
						ComputedUserset: &openfgav1.ObjectRelation{
							Relation: relation,
						},
					},
				},
			}, nil
		default:
			// This should never happen.
			return nil, fmt.Errorf("unknown edge type: %v for node: %s", edgeType, currentNode.GetUniqueLabel())
		}

	case graph.OperatorNode:
		switch currentNode.GetLabel() {
		case graph.ExclusionOperator:
			return t.ConstructExclusionUserset(currentNode, sourceUserType)
		case graph.IntersectionOperator:
			return t.ConstructIntersectionUserset(currentNode, sourceUserType)
		case graph.UnionOperator:
			return t.ConstructUnionUserset(currentNode, sourceUserType)
		default:
			// This should never happen.
			return nil, fmt.Errorf("unknown operator node label %s for node %s", currentNode.GetLabel(), currentNode.GetUniqueLabel())
		}
	default:
		// This should never happen.
		return nil, fmt.Errorf("unknown node type %v for node %s", currentNode.GetNodeType(), currentNode.GetUniqueLabel())
	}
}

func (t *TypeSystem) ConstructExclusionUserset(node *graph.WeightedAuthorizationModelNode, sourceUserType string) (*openfgav1.Userset, error) {
	edges, ok := t.authzWeightedGraph.GetEdgesFromNode(node)
	if !ok || node.GetLabel() != graph.ExclusionOperator {
		// This should never happen.
		return nil, fmt.Errorf("incorrect exclusion node: %s", node.GetUniqueLabel())
	}

	exclusionEdges, err := GetEdgesForExclusion(edges, sourceUserType)
	if err != nil {
		return nil, fmt.Errorf("error getting the edges for operation: exclusion: %s", err.Error())
	}

	baseUserset, err := t.ConstructUserset(exclusionEdges.BaseEdge, sourceUserType)
	if err != nil {
		return nil, fmt.Errorf("failed to construct userset for edge %s: %w", exclusionEdges.BaseEdge.GetTo().GetUniqueLabel(), err)
	}

	if exclusionEdges.ExcludedEdge == nil {
		return baseUserset, nil
	}

	excludedUserset, err := t.ConstructUserset(exclusionEdges.ExcludedEdge, sourceUserType)
	if err != nil {
		return nil, fmt.Errorf("failed to construct userset for edge %s: %w", exclusionEdges.ExcludedEdge.GetTo().GetUniqueLabel(), err)
	}

	return &openfgav1.Userset{
		Userset: &openfgav1.Userset_Difference{
			Difference: &openfgav1.Difference{
				Base:     baseUserset,
				Subtract: excludedUserset,
			}}}, nil
}

func (t *TypeSystem) ConstructIntersectionUserset(node *graph.WeightedAuthorizationModelNode, sourceUserType string) (*openfgav1.Userset, error) {
	edges, ok := t.authzWeightedGraph.GetEdgesFromNode(node)
	if !ok || node.GetLabel() != graph.IntersectionOperator {
		// This should never happen.
		return nil, fmt.Errorf("incorrect intersection node: %s", node.GetUniqueLabel())
	}
	var usersets []*openfgav1.Userset

	if len(edges) < 2 {
		return nil, fmt.Errorf("no valid edges found for intersection")
	}

	for _, edge := range edges {
		userset, err := t.ConstructUserset(edge, sourceUserType)
		if err != nil {
			return nil, fmt.Errorf("failed to construct userset for edge %s: %w", edge.GetTo().GetUniqueLabel(), err)
		}
		usersets = append(usersets, userset)
	}

	return &openfgav1.Userset{
		Userset: &openfgav1.Userset_Intersection{
			Intersection: &openfgav1.Usersets{
				Child: usersets,
			}}}, nil
}

func (t *TypeSystem) ConstructUnionUserset(node *graph.WeightedAuthorizationModelNode, sourceUserType string) (*openfgav1.Userset, error) {
	edges, ok := t.authzWeightedGraph.GetEdgesFromNode(node)
	if !ok || node.GetLabel() != graph.UnionOperator {
		// This should never happen.
		return nil, fmt.Errorf("incorrect union node: %s", node.GetUniqueLabel())
	}
	var usersets []*openfgav1.Userset

	if len(edges) < 2 {
		return nil, fmt.Errorf("no valid edges found for union")
	}

	for _, edge := range edges {
		userset, err := t.ConstructUserset(edge, sourceUserType)
		if err != nil {
			return nil, fmt.Errorf("failed to construct userset for edge %s: %w", edge.GetTo().GetUniqueLabel(), err)
		}
		usersets = append(usersets, userset)
	}

	return &openfgav1.Userset{
		Userset: &openfgav1.Userset_Union{
			Union: &openfgav1.Usersets{
				Child: usersets,
			}}}, nil
}
