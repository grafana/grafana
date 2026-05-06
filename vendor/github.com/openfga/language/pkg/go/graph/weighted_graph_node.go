package graph

type NodeType int64

const (
	SpecificType            NodeType = 0 // e.g. `group`
	SpecificTypeAndRelation NodeType = 1 // e.g. `group#viewer`
	OperatorNode            NodeType = 2 // e.g. union
	SpecificTypeWildcard    NodeType = 3 // e.g. `group:*`
	LogicalDirectGrouping   NodeType = 4 // e.g. `[user, employee, type1#rel]`
	LogicalTTUGrouping      NodeType = 5 // e.g. `member from parent, wherer parent can have multiple terminal types`

	UnionOperator        = "union"
	IntersectionOperator = "intersection"
	ExclusionOperator    = "exclusion"
)

type WeightedAuthorizationModelNode struct {
	weights           map[string]int
	nodeType          NodeType
	label             string   // e.g. "group#member", UnionOperator, IntersectionOperator, ExclusionOperator
	uniqueLabel       string   // e.g. "group#member", or "union:01JH0MR4H1MBFGVN37E4PRMPM3"
	wildcards         []string // e.g. "user". This means that from this node there is a path to node user:*
	recursiveRelation string
	tupleCycle        bool
	usersetWeights    map[string]int
}

// GetWeights returns the entire weights map.
func (node *WeightedAuthorizationModelNode) GetWeights() map[string]int {
	return node.weights
}

// GetWeight returns the weight for a specific type. It can return Infinite to indicate recursion.
func (node *WeightedAuthorizationModelNode) GetWeight(key string) (int, bool) {
	weight, exists := node.weights[key]
	return weight, exists
}

// GetNodeType returns the node type.
func (node *WeightedAuthorizationModelNode) GetNodeType() NodeType {
	return node.nodeType
}

// GetLabel returns the label, e.g. "user", "group#member", UnionOperator, IntersectionOperator or ExclusionOperator.
func (node *WeightedAuthorizationModelNode) GetLabel() string {
	return node.label
}

// GetUniqueLabel returns the unique label. It is the same as GetLabel, except for operation nodes,
// where it takes the form "operation:ULID".
func (node *WeightedAuthorizationModelNode) GetUniqueLabel() string {
	return node.uniqueLabel
}

// GetWildcards returns an array of types, e.g. "user". This means that from this node there is a path to node user:*.
func (node *WeightedAuthorizationModelNode) GetWildcards() []string {
	return node.wildcards
}

// GetRecursiveRelation returns a string of the recursive relation in a tuple cycle. A recursive relation only
// exists when the node is self-referential without any intermediate nodes of SpecificTypeAndRelation.
func (node *WeightedAuthorizationModelNode) GetRecursiveRelation() string {
	return node.recursiveRelation
}

// IsPartOfTupleCycle returns a true if the node is part of a cycle that involves more than one node of type SpecificTypeAndRelation.
func (node *WeightedAuthorizationModelNode) IsPartOfTupleCycle() bool {
	return node.tupleCycle
}
