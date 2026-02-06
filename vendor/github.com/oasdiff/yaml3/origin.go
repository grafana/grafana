package yaml

import "fmt"

const originTag = "__origin__"

func isScalar(n *Node) bool {
	return n.Kind == ScalarNode
}

func addOriginInSeq(n *Node) *Node {

	if n.Kind != MappingNode {
		return n
	}

	// in case of a sequence, we use the first element as the key
	return addOrigin(n.Content[0], n)
}

func addOriginInMap(key, n *Node) *Node {

	if n.Kind != MappingNode {
		return n
	}

	return addOrigin(key, n)
}

func addOrigin(key, n *Node) *Node {
	if isOrigin(key) {
		return n
	}

	n.Content = append(n.Content, getNamedMap(originTag, append(getKeyLocation(key), getNamedMap("fields", getFieldLocations(n))...))...)
	return n
}

func getFieldLocations(n *Node) []*Node {

	l := len(n.Content)
	size := 0
	for i := 0; i < l; i += 2 {
		if isScalar(n.Content[i+1]) {
			size += 2
		}
	}

	nodes := make([]*Node, 0, size)
	for i := 0; i < l; i += 2 {
		if isScalar(n.Content[i+1]) {
			nodes = append(nodes, getNodeLocation(n.Content[i])...)
		}
	}
	return nodes
}

// isOrigin returns true if the key is an "origin" element
// the current implementation is not optimal, as it relies on the key's line number
// a better design would be to use a dedicated field in the Node struct
func isOrigin(key *Node) bool {
	return key.Line == 0
}

func getNodeLocation(n *Node) []*Node {
	return getNamedMap(n.Value, getLocationObject(n))
}

func getKeyLocation(n *Node) []*Node {
	return getNamedMap("key", getLocationObject(n))
}

func getNamedMap(title string, content []*Node) []*Node {
	if len(content) == 0 {
		return nil
	}

	return []*Node{
		{
			Kind:  ScalarNode,
			Tag:   "!!str",
			Value: title,
		},
		getMap(content),
	}
}

func getMap(content []*Node) *Node {
	return &Node{
		Kind:    MappingNode,
		Tag:     "!!map",
		Content: content,
	}
}

func getLocationObject(key *Node) []*Node {
	return []*Node{
		{
			Kind:  ScalarNode,
			Tag:   "!!str",
			Value: "line",
		},
		{
			Kind:  ScalarNode,
			Tag:   "!!int",
			Value: fmt.Sprintf("%d", key.Line),
		},
		{
			Kind:  ScalarNode,
			Tag:   "!!str",
			Value: "column",
		},
		{
			Kind:  ScalarNode,
			Tag:   "!!int",
			Value: fmt.Sprintf("%d", key.Column),
		},
		{
			Kind:  ScalarNode,
			Tag:   "!!str",
			Value: "name",
		},
		{
			Kind:  ScalarNode,
			Tag:   "!!string",
			Value: key.Value,
		},
	}
}
