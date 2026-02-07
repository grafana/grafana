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

type NodeLabelsToIDs map[string]int64

type AuthorizationModelGraphBuilder struct {
	graph.DirectedMultigraphBuilder

	ids NodeLabelsToIDs // nodes: unique labels to ids. Used to find nodes by label.
}

// NewAuthorizationModelGraph builds an authorization model in graph form.
// For example, types such as `group`, usersets such as `group#member` and wildcards `group:*` are encoded as nodes.
// By default, the graph is drawn from bottom to top (i.e. terminal types have outgoing edges and no incoming edges).
// Conditions are not encoded in the graph.
func NewAuthorizationModelGraph(model *openfgav1.AuthorizationModel) (*AuthorizationModelGraph, error) {
	res, ids, err := parseModel(model)
	if err != nil {
		return nil, err
	}

	return &AuthorizationModelGraph{res, DrawingDirectionListObjects, ids}, nil
}

func parseModel(model *openfgav1.AuthorizationModel) (*multi.DirectedGraph, NodeLabelsToIDs, error) {
	graphBuilder := &AuthorizationModelGraphBuilder{
		multi.NewDirectedGraph(), map[string]int64{},
	}

	// sort types by name to guarantee stable output
	sortedTypeDefs := make([]*openfgav1.TypeDefinition, len(model.GetTypeDefinitions()))
	copy(sortedTypeDefs, model.GetTypeDefinitions())

	slices.SortFunc(sortedTypeDefs, func(a, b *openfgav1.TypeDefinition) int {
		return cmp.Compare(a.GetType(), b.GetType())
	})

	for _, typeDef := range sortedTypeDefs {
		graphBuilder.getOrAddNode(typeDef.GetType(), typeDef.GetType(), SpecificType)

		// sort relations by name to guarantee stable output
		sortedRelations := make([]string, 0, len(typeDef.GetRelations()))
		for relationName := range typeDef.GetRelations() {
			sortedRelations = append(sortedRelations, relationName)
		}

		slices.Sort(sortedRelations)

		for _, relation := range sortedRelations {
			uniqueLabel := fmt.Sprintf("%s#%s", typeDef.GetType(), relation)
			parentNode := graphBuilder.getOrAddNode(uniqueLabel, uniqueLabel, SpecificTypeAndRelation)
			rewrite := typeDef.GetRelations()[relation]
			checkRewrite(graphBuilder, parentNode, model, rewrite, typeDef, relation)
		}
	}

	multigraph, ok := graphBuilder.DirectedMultigraphBuilder.(*multi.DirectedGraph)
	if ok {
		return multigraph, graphBuilder.ids, nil
	}

	return nil, nil, fmt.Errorf("%w: could not cast to directed graph", ErrBuildingGraph)
}

func checkRewrite(graphBuilder *AuthorizationModelGraphBuilder, parentNode *AuthorizationModelNode, model *openfgav1.AuthorizationModel, rewrite *openfgav1.Userset, typeDef *openfgav1.TypeDefinition, relation string) {
	var operator string

	var children []*openfgav1.Userset

	switch rw := rewrite.GetUserset().(type) {
	case *openfgav1.Userset_This:
		parseThis(graphBuilder, parentNode, typeDef, relation)

		return
	case *openfgav1.Userset_ComputedUserset:
		parseComputed(graphBuilder, parentNode, typeDef, rw.ComputedUserset.GetRelation())

		return
	case *openfgav1.Userset_TupleToUserset:
		parseTupleToUserset(graphBuilder, parentNode, model, typeDef, rw.TupleToUserset)

		return
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

	operatorNode := fmt.Sprintf("%s:%s", operator, ulid.Make().String())
	operatorNodeParent := graphBuilder.getOrAddNode(operatorNode, operator, OperatorNode)

	// add one edge "operator" -> "relation that defined the operator"
	// Note: if this is a composition of operators, operationNode will be nil and this edge won't be added.
	graphBuilder.AddEdge(operatorNodeParent, parentNode, RewriteEdge, "", nil)
	for _, child := range children {
		checkRewrite(graphBuilder, operatorNodeParent, model, child, typeDef, relation)
	}
}

func parseThis(graphBuilder *AuthorizationModelGraphBuilder, parentNode graph.Node, typeDef *openfgav1.TypeDefinition, relation string) {
	directlyRelated := make([]*openfgav1.RelationReference, 0)
	var curNode *AuthorizationModelNode

	if relationMetadata, ok := typeDef.GetMetadata().GetRelations()[relation]; ok {
		directlyRelated = relationMetadata.GetDirectlyRelatedUserTypes()
	}

	for _, directlyRelatedDef := range directlyRelated {
		if directlyRelatedDef.GetRelationOrWildcard() == nil {
			// direct assignment to concrete type
			assignableType := directlyRelatedDef.GetType()
			curNode = graphBuilder.getOrAddNode(assignableType, assignableType, SpecificType)
		}

		if directlyRelatedDef.GetWildcard() != nil {
			// direct assignment to wildcard
			assignableWildcard := directlyRelatedDef.GetType() + ":*"
			curNode = graphBuilder.getOrAddNode(assignableWildcard, assignableWildcard, SpecificTypeWildcard)
		}

		if directlyRelatedDef.GetRelation() != "" {
			// direct assignment to userset
			assignableUserset := directlyRelatedDef.GetType() + "#" + directlyRelatedDef.GetRelation()
			curNode = graphBuilder.getOrAddNode(assignableUserset, assignableUserset, SpecificTypeAndRelation)
		}

		// de-dup types that are conditioned, e.g. if define viewer: [user, user with condX]
		// we only draw one edge from user to x#viewer, but with two conditions: none and condX
		graphBuilder.upsertEdge(curNode, parentNode, DirectEdge, "", directlyRelatedDef.GetCondition())
	}
}

func parseComputed(graphBuilder *AuthorizationModelGraphBuilder, parentNode *AuthorizationModelNode, typeDef *openfgav1.TypeDefinition, relation string) {
	nodeType := RewriteEdge
	// e.g. define x: y. Here y is the rewritten relation
	rewrittenNodeName := fmt.Sprintf("%s#%s", typeDef.GetType(), relation)
	newNode := graphBuilder.getOrAddNode(rewrittenNodeName, rewrittenNodeName, SpecificTypeAndRelation)
	// new edge from y to x

	if parentNode.nodeType == SpecificTypeAndRelation && newNode.nodeType == SpecificTypeAndRelation {
		nodeType = ComputedEdge
	}
	graphBuilder.AddEdge(newNode, parentNode, nodeType, "", nil)
}

func parseTupleToUserset(graphBuilder *AuthorizationModelGraphBuilder, parentNode graph.Node, model *openfgav1.AuthorizationModel, typeDef *openfgav1.TypeDefinition, rewrite *openfgav1.TupleToUserset) {
	// e.g. define viewer: admin from parent
	// "parent" is the tupleset
	tuplesetRelation := rewrite.GetTupleset().GetRelation()
	// "admin" is the computed relation
	computedRelation := rewrite.GetComputedUserset().GetRelation()

	// find all the directly related types to the tupleset
	directlyRelated := make([]*openfgav1.RelationReference, 0)
	if relationMetadata, ok := typeDef.GetMetadata().GetRelations()[tuplesetRelation]; ok {
		directlyRelated = relationMetadata.GetDirectlyRelatedUserTypes()
	}

	for _, relatedType := range directlyRelated {
		tuplesetType := relatedType.GetType()

		if !typeAndRelationExists(model, tuplesetType, computedRelation) {
			continue
		}

		rewrittenNodeName := fmt.Sprintf("%s#%s", tuplesetType, computedRelation)
		nodeSource := graphBuilder.getOrAddNode(rewrittenNodeName, rewrittenNodeName, SpecificTypeAndRelation)
		typeTuplesetRelation := fmt.Sprintf("%s#%s", typeDef.GetType(), tuplesetRelation)

		if graphBuilder.hasEdge(nodeSource, parentNode, TTUEdge, typeTuplesetRelation) {
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
		graphBuilder.upsertEdge(nodeSource, parentNode, TTUEdge, typeTuplesetRelation, relatedType.GetCondition())
	}
}

func (g *AuthorizationModelGraphBuilder) getOrAddNode(uniqueLabel, label string, nodeType NodeType) *AuthorizationModelNode {
	if existingNode := g.getNodeByLabel(uniqueLabel); existingNode != nil {
		return existingNode
	}

	node := g.NewNode()
	nodeid := node.ID()
	newNode := &AuthorizationModelNode{
		Node:        node,
		label:       label,
		nodeType:    nodeType,
		uniqueLabel: uniqueLabel,
	}
	g.AddNode(newNode)
	g.ids[uniqueLabel] = nodeid

	return newNode
}

func (g *AuthorizationModelGraphBuilder) getNodeByLabel(uniqueLabel string) *AuthorizationModelNode {
	id, ok := g.ids[uniqueLabel]
	if !ok {
		return nil
	}

	authModelNode, ok := g.Node(id).(*AuthorizationModelNode)
	if !ok {
		return nil
	}

	return authModelNode
}

func (g *AuthorizationModelGraphBuilder) AddEdge(from, to graph.Node, edgeType EdgeType, tuplesetRelation string, conditions []string) *AuthorizationModelEdge {
	if from == nil || to == nil {
		return nil
	}
	if len(conditions) == 0 {
		conditions = []string{NoCond}
	}

	l := g.NewLine(from, to)
	newLine := &AuthorizationModelEdge{Line: l, edgeType: edgeType, tuplesetRelation: tuplesetRelation, conditions: conditions}
	g.SetLine(newLine)

	return newLine
}

func (g *AuthorizationModelGraphBuilder) upsertEdge(from, to graph.Node, edgeType EdgeType, tuplesetRelation string, condition string) {
	if from == nil || to == nil {
		return
	}

	iter := g.Lines(from.ID(), to.ID())
	for iter.Next() {
		l := iter.Line()
		edge, _ := l.(*AuthorizationModelEdge)
		if edge.edgeType == edgeType && edge.tuplesetRelation == tuplesetRelation {
			for _, cond := range edge.conditions {
				if cond == condition {
					return
				}
			}
			edge.conditions = append(edge.conditions, condition)
			return
		}
	}

	g.AddEdge(from, to, edgeType, tuplesetRelation, []string{condition})
}

func (g *AuthorizationModelGraphBuilder) hasEdge(from, to graph.Node, edgeType EdgeType, tuplesetRelation string) bool {
	if from == nil || to == nil {
		return false
	}

	iter := g.Lines(from.ID(), to.ID())
	for iter.Next() {
		l := iter.Line()
		edge, _ := l.(*AuthorizationModelEdge)
		if edge.edgeType == edgeType && edge.tuplesetRelation == tuplesetRelation {
			return true
		}
	}

	return false
}

func typeAndRelationExists(model *openfgav1.AuthorizationModel, typeName, relation string) bool {
	typeDefs := model.GetTypeDefinitions()
	// TODO this should be made faster, ideally typeDefs is a map
	for _, typeDef := range typeDefs {
		if typeDef.GetType() == typeName {
			relations := typeDef.GetRelations()
			if _, ok := relations[relation]; ok {
				return true
			}
		}
	}

	return false
}
