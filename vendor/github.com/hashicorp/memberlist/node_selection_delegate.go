// SPDX-License-Identifier: MPL-2.0

package memberlist

// NodeSelectionDelegate is an optional delegate that can be used to filter and prioritize
// nodes for gossip, and push/pull operations. This allows implementing custom routing logic,
// such as zone-aware or rack-aware gossiping.
//
// This delegate is not used for probes (health checks). When implementing zone-aware gossiping,
// probes can bypass this delegate.
type NodeSelectionDelegate interface {
	// SelectNodes filters and prioritizes nodes for selection. It receives all candidate nodes
	// and returns:
	// - selected: the nodes that should be included in the selection pool
	// - preferred: an optional single node that should be prioritized. During a gossip cycle,
	//              the preferred node is always included if present. If nil, all gossip targets
	//              are chosen randomly from the selected nodes.
	//              It is not necessary to include the preferred node in the selected ones nor to explicitly remove it from them.
	// The input NodeState slice cannot be manipulated in-place, but if all input nodes are selected
	// then it's safe to return the input slice as is.
	//
	// It's not required for the preferred node to be included in the selected slice. The preferred
	// node would be picked anyway.
	SelectNodes([]*NodeState) (selected []*NodeState, preferred *NodeState)
}
