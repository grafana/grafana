package graph

import (
	"errors"
	"fmt"

	"gonum.org/v1/gonum/graph"
	"gonum.org/v1/gonum/graph/encoding"
	"gonum.org/v1/gonum/graph/encoding/dot"
	"gonum.org/v1/gonum/graph/multi"
	"gonum.org/v1/gonum/graph/topo"
)

var (
	ErrBuildingGraph = errors.New("cannot build graph")
	ErrQueryingGraph = errors.New("cannot query graph")
)

type DrawingDirection bool

const (
	// DrawingDirectionListObjects is when terminal types have outgoing edges and no incoming edges.
	DrawingDirectionListObjects DrawingDirection = true
	// DrawingDirectionCheck is when terminal types have incoming edges and no outgoing edges.
	DrawingDirectionCheck DrawingDirection = false
)

type AuthorizationModelGraph struct {
	*multi.DirectedGraph
	drawingDirection DrawingDirection
	ids              NodeLabelsToIDs
}

func (g *AuthorizationModelGraph) GetDrawingDirection() DrawingDirection {
	return g.drawingDirection
}

// GetNodeByLabel provides O(1) access to a node. If the node doesn't exist, it returns ErrQueryingGraph.
func (g *AuthorizationModelGraph) GetNodeByLabel(label string) (*AuthorizationModelNode, error) {
	id, ok := g.ids[label]
	if !ok {
		return nil, fmt.Errorf("%w: node with label %s not found", ErrQueryingGraph, label)
	}

	node := g.Node(id)
	if node == nil {
		return nil, fmt.Errorf("%w: node with id %d not found", ErrQueryingGraph, id)
	}

	casted, ok := node.(*AuthorizationModelNode)
	if !ok {
		return nil, fmt.Errorf("%w: could not cast to AuthorizationModelNode", ErrQueryingGraph)
	}

	return casted, nil
}

// Reversed returns a full copy of the graph, but with the direction of the arrows flipped.
func (g *AuthorizationModelGraph) Reversed() (*AuthorizationModelGraph, error) {
	graphBuilder := &AuthorizationModelGraphBuilder{
		multi.NewDirectedGraph(), map[string]int64{},
	}

	// Add all nodes as-is.
	iterNodes := g.Nodes()
	for iterNodes.Next() {
		nextNode := iterNodes.Node()
		graphBuilder.AddNode(nextNode)
	}

	// Add all edges as-is, but with their From and To flipped.
	iterEdges := g.Edges()
	for iterEdges.Next() {
		nextEdge, ok := iterEdges.Edge().(multi.Edge)
		if !ok {
			return nil, fmt.Errorf("%w: could not cast to multi.Edge", ErrBuildingGraph)
		}
		// NOTE: because we use a multigraph, one edge can include multiple lines, so we need to add each line individually.
		iterLines := nextEdge.Lines
		for iterLines.Next() {
			nextLine := iterLines.Line()
			casted, ok := nextLine.(*AuthorizationModelEdge)
			if !ok {
				return nil, fmt.Errorf("%w: could not cast to AuthorizationModelEdge", ErrBuildingGraph)
			}
			graphBuilder.AddEdge(nextLine.To(), nextLine.From(), casted.edgeType, casted.tuplesetRelation, casted.conditions)
		}
	}

	// Make a brand new copy of the map.
	copyIDs := make(NodeLabelsToIDs, len(g.ids))
	for k, v := range g.ids {
		copyIDs[k] = v
	}

	multigraph, ok := graphBuilder.DirectedMultigraphBuilder.(*multi.DirectedGraph)
	if ok {
		return &AuthorizationModelGraph{multigraph, !g.drawingDirection, copyIDs}, nil
	}

	return nil, fmt.Errorf("%w: could not cast to directed graph", ErrBuildingGraph)
}

// PathExists returns true if both nodes exist and there is a path starting at 'fromLabel' extending to 'toLabel'.
// If both labels are equal, it returns true.
// If either node doesn't exist, it returns false and ErrQueryingGraph.
// Note: if somewhere in the path there is an IntersectionOperator or ExclusionOperator, it will NOT return false
// if there is some child that does NOT reach 'toLabel'.
func (g *AuthorizationModelGraph) PathExists(fromLabel, toLabel string) (bool, error) {
	fromNode, err := g.GetNodeByLabel(fromLabel)
	if err != nil {
		return false, err
	}

	toNode, err := g.GetNodeByLabel(toLabel)
	if err != nil {
		return false, err
	}

	return topo.PathExistsIn(g.DirectedGraph, fromNode, toNode), nil
}

var _ dot.Attributers = (*AuthorizationModelGraph)(nil)

func (g *AuthorizationModelGraph) DOTAttributers() (encoding.Attributer, encoding.Attributer, encoding.Attributer) {
	return g, nil, nil
}

func (g *AuthorizationModelGraph) Attributes() []encoding.Attribute {
	rankdir := "BT" // bottom to top
	if g.drawingDirection == DrawingDirectionCheck {
		rankdir = "TB" // top to bottom
	}

	return []encoding.Attribute{{
		Key:   "rankdir", // https://graphviz.org/docs/attrs/rankdir/
		Value: rankdir,
	}}
}

// GetDOT returns the DOT visualization. The output text is stable.
// It should only be used for debugging.
func (g *AuthorizationModelGraph) GetDOT() string {
	dotRepresentation, err := dot.MarshalMulti(g, "", "", "")
	if err != nil {
		return ""
	}

	return string(dotRepresentation)
}

// CycleInformation encapsulates whether the graph has cycles.
type CycleInformation struct {
	// If hasCyclesAtCompileTime is true, we should block this model from ever being written.
	// This is because we are trying to perform a Check on it will cause a stack overflow no matter what the tuples are.
	hasCyclesAtCompileTime bool

	// If canHaveCyclesAtRuntime is true, there could exist tuples that introduce a cycle.
	canHaveCyclesAtRuntime bool
}

func (g *AuthorizationModelGraph) nodeListHasNonComputedEdge(nodeList []graph.Node) bool {
	for i, nodeI := range nodeList {
		for _, nodeJ := range nodeList[i+1:] {
			allEdges := g.Lines(nodeI.ID(), nodeJ.ID())
			for allEdges.Next() {
				edge, ok := allEdges.Line().(*AuthorizationModelEdge)
				if ok && edge.edgeType != ComputedEdge {
					return true
				}
			}
		}
	}

	return false
}

func (g *AuthorizationModelGraph) GetCycles() CycleInformation {
	hasCyclesAtCompileTime := false
	hasCyclesAtRuntime := false

	// TODO: investigate whether len(1) should be identified as cycle

	nodes := topo.DirectedCyclesIn(g)
	for _, nodeList := range nodes {
		if g.nodeListHasNonComputedEdge(nodeList) {
			hasCyclesAtRuntime = true
		} else {
			hasCyclesAtCompileTime = true
		}
	}

	return CycleInformation{
		hasCyclesAtCompileTime: hasCyclesAtCompileTime,
		canHaveCyclesAtRuntime: hasCyclesAtRuntime,
	}
}

// TODO add graph traversals, etc.
