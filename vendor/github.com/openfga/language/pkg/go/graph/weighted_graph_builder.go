package graph

import (
	"cmp"
	"fmt"
	"slices"

	"github.com/oklog/ulid/v2"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"gonum.org/v1/gonum/graph"
	"gonum.org/v1/gonum/graph/multi"
)

type WeightedAuthorizationModelGraphBuilder struct {
	graph.DirectedMultigraphBuilder
	drawingDirection DrawingDirection
}

func NewWeightedAuthorizationModelGraphBuilder() *WeightedAuthorizationModelGraphBuilder {
	return &WeightedAuthorizationModelGraphBuilder{multi.NewDirectedGraph(), DrawingDirectionCheck}
}

func (wgb *WeightedAuthorizationModelGraphBuilder) Build(model *openfgav1.AuthorizationModel) (*WeightedAuthorizationModelGraph, error) {
	wb := NewWeightedAuthorizationModelGraph()
	// sort types by name to guarantee stable output
	sortedTypeDefs := make([]*openfgav1.TypeDefinition, len(model.GetTypeDefinitions()))
	copy(sortedTypeDefs, model.GetTypeDefinitions())

	slices.SortFunc(sortedTypeDefs, func(a, b *openfgav1.TypeDefinition) int {
		return cmp.Compare(a.GetType(), b.GetType())
	})

	for _, typeDef := range sortedTypeDefs {
		wb.GetOrAddNode(typeDef.GetType(), typeDef.GetType(), SpecificType)

		// sort relations by name to guarantee stable output
		sortedRelations := make([]string, 0, len(typeDef.GetRelations()))
		for relationName := range typeDef.GetRelations() {
			sortedRelations = append(sortedRelations, relationName)
		}

		slices.Sort(sortedRelations)

		for _, relation := range sortedRelations {
			uniqueLabel := typeDef.GetType() + "#" + relation
			parentNode := wb.GetOrAddNode(uniqueLabel, uniqueLabel, SpecificTypeAndRelation)
			rewrite := typeDef.GetRelations()[relation]
			err := wgb.parseRewrite(wb, parentNode, model, rewrite, typeDef, relation)
			if err != nil {
				return nil, err
			}
		}
	}

	err := wb.AssignWeights()
	if err != nil {
		return nil, err
	}

	return wb, nil
}

func (wgb *WeightedAuthorizationModelGraphBuilder) parseRewrite(wg *WeightedAuthorizationModelGraph, parentNode *WeightedAuthorizationModelNode, model *openfgav1.AuthorizationModel, rewrite *openfgav1.Userset, typeDef *openfgav1.TypeDefinition, relation string) error {
	var operator string
	parentNodeName := fmt.Sprintf("%s#%s", typeDef.GetType(), relation)

	var children []*openfgav1.Userset

	switch rw := rewrite.GetUserset().(type) {
	case *openfgav1.Userset_This:
		return wgb.parseThis(wg, parentNode, typeDef, relation, parentNodeName)
	case *openfgav1.Userset_ComputedUserset:
		wgb.parseComputed(wg, parentNode, typeDef, rw.ComputedUserset.GetRelation(), parentNodeName)
		return nil
	case *openfgav1.Userset_TupleToUserset:
		return wgb.parseTupleToUserset(wg, parentNode, model, typeDef, rw.TupleToUserset, parentNodeName)
	case *openfgav1.Userset_Union:
		operator = UnionOperator
		children = rw.Union.GetChild()

	case *openfgav1.Userset_Intersection:
		operator = IntersectionOperator
		children = rw.Intersection.GetChild()

	case *openfgav1.Userset_Difference:
		operator = ExclusionOperator
		children = []*openfgav1.Userset{
			rw.Difference.GetBase(),
			rw.Difference.GetSubtract(),
		}
	}

	operatorNodeName := operator + ":" + ulid.Make().String()
	operatorNode := wg.GetOrAddNode(operatorNodeName, operator, OperatorNode)

	// add one edge "relation" -> "operation that defined the operator"
	// Note: if this is a composition of operators, operationNode will be nil and this edge won't be added.
	wg.AddEdge(parentNode.GetUniqueLabel(), operatorNodeName, RewriteEdge, parentNodeName, "", nil)
	for _, child := range children {
		err := wgb.parseRewrite(wg, operatorNode, model, child, typeDef, relation)
		if err != nil {
			return err
		}
	}
	return nil
}

func (wgb *WeightedAuthorizationModelGraphBuilder) parseTupleToUserset(wg *WeightedAuthorizationModelGraph, parentNode *WeightedAuthorizationModelNode, model *openfgav1.AuthorizationModel, typeDef *openfgav1.TypeDefinition, rewrite *openfgav1.TupleToUserset, parentRelationName string) error {
	// e.g. define viewer: admin from parent
	// "parent" is the tupleset
	tuplesetRelation := rewrite.GetTupleset().GetRelation()
	// "admin" is the computed relation
	computedRelation := rewrite.GetComputedUserset().GetRelation()

	// find all the directly related types to the tupleset
	relationMetadata, ok := typeDef.GetMetadata().GetRelations()[tuplesetRelation]
	if !ok {
		return fmt.Errorf("%w: Model cannot be parsed. %s invalid tupleset relation", ErrInvalidModel, tuplesetRelation)
	}
	directlyRelated := relationMetadata.GetDirectlyRelatedUserTypes()
	if len(directlyRelated) == 0 {
		return fmt.Errorf("%w: Model cannot be parsed. No type and relation link exists for tupleset relation %s and computed relation %s", ErrInvalidModel, tuplesetRelation, computedRelation)
	}

	typeTuplesetRelation := typeDef.GetType() + "#" + tuplesetRelation
	node := parentNode
	if parentNode.nodeType != SpecificTypeAndRelation && len(directlyRelated) > 1 {
		uniqueLabel := typeDef.GetType() + "#ttu:" + tuplesetRelation + "#" + computedRelation
		// add a logical ttu node for grouping of TTU that are part of the same tuplesetrelation and computed relation
		logicalNode := wg.GetOrAddNode(uniqueLabel, uniqueLabel, LogicalTTUGrouping)
		wg.AddEdge(parentNode.uniqueLabel, logicalNode.uniqueLabel, TTULogicalEdge, parentRelationName, typeTuplesetRelation, nil)
		node = logicalNode
	}

	for _, relatedType := range directlyRelated {
		tuplesetType := relatedType.GetType()

		if !typeAndRelationExists(model, tuplesetType, computedRelation) {
			return fmt.Errorf("%w: Model cannot be parsed. %s type does not have defined %s relation", ErrInvalidModel, tuplesetType, computedRelation)
		}

		rewrittenNodeName := fmt.Sprintf("%s#%s", tuplesetType, computedRelation)
		nodeSource := wg.GetOrAddNode(rewrittenNodeName, rewrittenNodeName, SpecificTypeAndRelation)

		if wg.HasEdge(node, nodeSource, TTUEdge, typeTuplesetRelation) {
			// we don't need to do any condition update, only de-dup the edge. In case of TTU
			// the direct relation will have the conditions
			// for example, in the case of
			// type group
			//   relations
			// 		define rel1: [user] or rel1 from parent
			//		define parent: [group, group with condX]
			// In the graph we only have one TTU edge from the OR node to the group#rel1 node, but there are no conditions associated to it
			// the conditions are associated to the edge from group#parent node to the group node. This direct edge has two conditions: none and condX
			continue
		}

		// new edge from "xxx#admin" to "yyy#viewer" tuplesetRelation on "yyy#parent"
		wg.UpsertEdge(node, nodeSource, TTUEdge, parentRelationName, typeTuplesetRelation, relatedType.GetCondition())
	}
	return nil
}

func (wgb *WeightedAuthorizationModelGraphBuilder) parseComputed(wg *WeightedAuthorizationModelGraph, parentNode *WeightedAuthorizationModelNode, typeDef *openfgav1.TypeDefinition, relation string, parentRelationName string) {
	nodeType := RewriteEdge
	// e.g. define x: y. Here y is the rewritten relation
	rewrittenNodeName := typeDef.GetType() + "#" + relation
	newNode := wg.GetOrAddNode(rewrittenNodeName, rewrittenNodeName, SpecificTypeAndRelation)
	// new edge from x to y
	if parentNode.nodeType == SpecificTypeAndRelation && newNode.nodeType == SpecificTypeAndRelation {
		nodeType = ComputedEdge
	}
	wg.AddEdge(parentNode.uniqueLabel, newNode.uniqueLabel, nodeType, parentRelationName, "", nil)
}

func (wgb *WeightedAuthorizationModelGraphBuilder) parseThis(wg *WeightedAuthorizationModelGraph, parentNode *WeightedAuthorizationModelNode, typeDef *openfgav1.TypeDefinition, relation string, parentRelationName string) error {
	var directlyRelated []*openfgav1.RelationReference
	var curNode *WeightedAuthorizationModelNode

	if relationMetadata, ok := typeDef.GetMetadata().GetRelations()[relation]; ok {
		directlyRelated = relationMetadata.GetDirectlyRelatedUserTypes()
	}
	node := parentNode
	// add a logical userset node for grouping of direct usersets that are defined in the same relation
	if parentNode.nodeType != SpecificTypeAndRelation && len(directlyRelated) > 1 {
		uniqueLabel := typeDef.GetType() + "#direct:" + relation
		logicalNode := wg.GetOrAddNode(uniqueLabel, uniqueLabel, LogicalDirectGrouping)
		wg.AddEdge(parentNode.uniqueLabel, logicalNode.uniqueLabel, DirectLogicalEdge, parentRelationName, "", nil)
		node = logicalNode
	}

	for _, directlyRelatedDef := range directlyRelated {
		switch {
		case directlyRelatedDef.GetRelationOrWildcard() == nil:
			// direct assignment to concrete type
			assignableType := directlyRelatedDef.GetType()
			curNode = wg.GetOrAddNode(assignableType, assignableType, SpecificType)
		case directlyRelatedDef.GetWildcard() != nil:
			// direct assignment to wildcard
			assignableWildcard := directlyRelatedDef.GetType() + ":*"
			curNode = wg.GetOrAddNode(assignableWildcard, assignableWildcard, SpecificTypeWildcard)
		default:
			// direct assignment to userset
			assignableUserset := directlyRelatedDef.GetType() + "#" + directlyRelatedDef.GetRelation()
			curNode = wg.GetOrAddNode(assignableUserset, assignableUserset, SpecificTypeAndRelation)
		}

		// de-dup types that are conditioned, e.g. if define viewer: [user, user with condX]
		// we only draw one edge from user to x#viewer, but with two conditions: none and condX
		err := wg.UpsertEdge(node, curNode, DirectEdge, parentRelationName, "", directlyRelatedDef.GetCondition())
		if err != nil {
			return err
		}
	}
	return nil
}
