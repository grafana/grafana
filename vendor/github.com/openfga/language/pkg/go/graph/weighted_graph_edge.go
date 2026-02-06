package graph

type EdgeType int64

const (
	// DirectEdge leads directly to a single type or type#rel
	//
	// e.g. define rel1: [user]
	// define rel2: [group#member]
	//define rel2: [user, employee, user:*, user:* with xcond, employee with xcond, group#member, group#member with xcond]
	DirectEdge EdgeType = 0

	// RewriteEdge leads from an operator to a relation
	//
	// in `define rel1: a OR b`, the edge from `OR --> b` and the edge from rel1 -> OR
	RewriteEdge EdgeType = 1

	// TTUEdge points to a tuple to userset relation
	//
	// e.g. define rel1: admin from parent
	TTUEdge EdgeType = 2

	// ComputedEdge points to another relation
	//
	// e.g. define rel1: rel2
	ComputedEdge EdgeType = 3

	// DirectLogicalEdge points to the LogicalDirectGrouping of multiple direct edges that are part of an operator node
	//
	// define rel1: [user, employee, group#member] or rel2
	// in this case OR node has two edges, one rewrite edge that goes to rel2 and another one that goes the direct edges grouping
	// however, when there is not operator node involved then the LogicalDirectGrouping is not created to avoid unnecesary nested nodes creation
	// for example in this use case,
	// define rel1: [user, employee, group#member]
	// the node rel1 has three direct edges
	DirectLogicalEdge EdgeType = 4

	// TTULogicalEdge points to the LogicalTTUGrouping when a TTU has multiple possible parents and are part of an operator node
	// For example, if both team and group below had a #viewer relation and viewer from parent is defined as part of a union operation
	// then a new node is create to group the TTUs
	//
	// define parent: [team, group]
	// define can_view: viewer from parent or member
	// however, when there is not operator node involved then the LogicalTTUGrouping is not created to avoid unnecesary nested nodes creation
	// for example in this use case no LogicalTTUGrouping is created, the two ttu edges are referenced directly from the can_view relation node
	// define can_view: viewer from parent
	// define parent: [team, group]
	TTULogicalEdge EdgeType = 5

	// When an edge does not have cond in the model, it will have a condition with value none.
	// This is required to differentiate when an edge need to support condition and no condition
	// like define rel1: [user, user with condX], in this case the edge will have [none, condX]
	// or an edge needs to support only condition like define rel1: [user with condX], the edge will have [condX]
	// in the case the edge does not have any condition like define rel1: [user], the edge will have [none].
	NoCond string = ""
)

type WeightedAuthorizationModelEdge struct {
	weights            map[string]int
	edgeType           EdgeType
	tuplesetRelation   string // only present when the edgeType is a TTUEdge
	from               *WeightedAuthorizationModelNode
	to                 *WeightedAuthorizationModelNode
	wildcards          []string // e.g. "user". This means that in the direction of this edge there is a path to node user:*
	recursiveRelation  string
	tupleCycle         bool
	relationDefinition string // the relation definition that generated this edge
	// conditions on the edge. This is a flattened graph with deduplicated edges,
	// if you have a node with multiple edges to another node will be deduplicate and instead
	// only one edge but with multiple conditions,
	// define rel1: [user, user with condX]
	// then the node rel1 will have an edge pointing to the node user and with two conditions
	// one that will be none and another one that will be condX
	conditions     []string
	usersetWeights map[string]int
}

// GetWeights returns the entire weights map.
func (edge *WeightedAuthorizationModelEdge) GetWeights() map[string]int {
	return edge.weights
}

// GetWeight returns the weight for a specific type. It can return Infinite to indicate recursion.
func (edge *WeightedAuthorizationModelEdge) GetWeight(key string) (int, bool) {
	weight, exists := edge.weights[key]
	return weight, exists
}

// GetEdgeType returns the edge type.
func (edge *WeightedAuthorizationModelEdge) GetEdgeType() EdgeType {
	return edge.edgeType
}

// GetTuplesetRelation returns the tuplesetRelation field, e.g. "document#parent".
func (edge *WeightedAuthorizationModelEdge) GetTuplesetRelation() string {
	return edge.tuplesetRelation
}

// GetRelationDefinition returns the relationDefinition field, e.g. "document#parent".
func (edge *WeightedAuthorizationModelEdge) GetRelationDefinition() string {
	return edge.relationDefinition
}

// GetConditions returns the conditions field, e.g. "none, condX".
func (edge *WeightedAuthorizationModelEdge) GetConditions() []string {
	return edge.conditions
}

// GetFrom returns the from node.
func (edge *WeightedAuthorizationModelEdge) GetFrom() *WeightedAuthorizationModelNode {
	return edge.from
}

// GetTo returns the to node.
func (edge *WeightedAuthorizationModelEdge) GetTo() *WeightedAuthorizationModelNode {
	return edge.to
}

// GetWildcards returns an array of types, e.g. "user". This means that in the direction of this edge there is a path to node user:*.
func (edge *WeightedAuthorizationModelEdge) GetWildcards() []string {
	return edge.wildcards
}

// GetRecursiveRelation returns a string of the recursive relation in a tuple cycle. A recursive relation only
// exists when the node is self-referential without any intermediate nodes of SpecificTypeAndRelation.
func (edge *WeightedAuthorizationModelEdge) GetRecursiveRelation() string {
	return edge.recursiveRelation
}

// IsPartOfTupleCycle returns a true if the edge is part of a cycle path that involves more than one node of type SpecificTypeAndRelation.
func (edge *WeightedAuthorizationModelEdge) IsPartOfTupleCycle() bool {
	return edge.tupleCycle
}
