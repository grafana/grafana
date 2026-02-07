// Loser tree, from https://en.wikipedia.org/wiki/K-way_merge_algorithm#Tournament_Tree

package loser

import "cmp"

func New[E cmp.Ordered](lists [][]E, maxVal E) *Tree[E] {
	nLists := len(lists)
	t := Tree[E]{
		maxVal: maxVal,
		nodes:  make([]node[E], nLists*2),
	}
	for i, s := range lists {
		t.nodes[i+nLists].items = s
		t.moveNext(i + nLists) // Must call Next on each item so that At() has a value.
	}
	if nLists > 0 {
		t.nodes[0].index = -1 // flag to be initialized on first call to Next().
	}
	return &t
}

// A loser tree is a binary tree laid out such that nodes N and N+1 have parent N/2.
// We store M leaf nodes in positions M...2M-1, and M-1 internal nodes in positions 1..M-1.
// Node 0 is a special node, containing the winner of the contest.
type Tree[E cmp.Ordered] struct {
	maxVal E
	nodes  []node[E]
}

type node[E cmp.Ordered] struct {
	index int // This is the loser for all nodes except the 0th, where it is the winner.
	value E   // Value copied from the loser node, or winner for node 0.
	items []E // Only populated for leaf nodes.
}

func (t *Tree[E]) moveNext(index int) bool {
	n := &t.nodes[index]
	if len(n.items) > 0 {
		n.value = n.items[0]
		n.items = n.items[1:]
		return true
	}
	n.value = t.maxVal
	n.index = -1
	return false
}

func (t *Tree[E]) Winner() E {
	return t.nodes[t.nodes[0].index].value
}

func (t *Tree[E]) Next() bool {
	if len(t.nodes) == 0 {
		return false
	}
	if t.nodes[0].index == -1 { // If tree has not been initialized yet, do that.
		t.initialize()
		return t.nodes[t.nodes[0].index].index != -1
	}
	if t.nodes[t.nodes[0].index].index == -1 { // already exhausted
		return false
	}
	if t.moveNext(t.nodes[0].index) {
		t.replayGames(t.nodes[0].index)
	} else {
		t.sequenceEnded(t.nodes[0].index)
	}
	return t.nodes[t.nodes[0].index].index != -1
}

func (t *Tree[E]) initialize() {
	winners := make([]int, len(t.nodes))
	// Initialize leaf nodes as winners to start.
	for i := len(t.nodes) / 2; i < len(t.nodes); i++ {
		winners[i] = i
	}
	for i := len(t.nodes) - 2; i > 0; i -= 2 {
		// At each stage the winners play each other, and we record the loser in the node.
		loser, winner := t.playGame(winners[i], winners[i+1])
		p := parent(i)
		t.nodes[p].index = loser
		t.nodes[p].value = t.nodes[loser].value
		winners[p] = winner
	}
	t.nodes[0].index = winners[1]
	t.nodes[0].value = t.nodes[winners[1]].value
}

// Starting at pos, which is a winner, re-consider all values up to the root.
func (t *Tree[E]) replayGames(pos int) {
	// At the start, pos is a leaf node, and is the winner at that level.
	n := parent(pos)
	for n != 0 {
		// If n.value < pos.value then pos loses.
		// If they are equal, pos wins because n could be a sequence that ended, with value maxval.
		if t.nodes[n].value < t.nodes[pos].value {
			loser := pos
			// Record pos as the loser here, and the old loser is the new winner.
			pos = t.nodes[n].index
			t.nodes[n].index = loser
			t.nodes[n].value = t.nodes[loser].value
		}
		n = parent(n)
	}
	// pos is now the winner; store it in node 0.
	t.nodes[0].index = pos
	t.nodes[0].value = t.nodes[pos].value
}

func (t *Tree[E]) sequenceEnded(pos int) {
	// Find the first active sequence which used to lose to it.
	n := parent(pos)
	for n != 0 && t.nodes[t.nodes[n].index].index == -1 {
		n = parent(n)
	}
	if n == 0 {
		// There are no active sequences left
		t.nodes[0].index = pos
		t.nodes[0].value = t.maxVal
		return
	}

	// Record pos as the loser here, and the old loser is the new winner.
	loser := pos
	winner := t.nodes[n].index
	t.nodes[n].index = loser
	t.nodes[n].value = t.nodes[loser].value
	t.replayGames(winner)
}

func (t *Tree[E]) playGame(a, b int) (loser, winner int) {
	if t.nodes[a].value < t.nodes[b].value {
		return b, a
	}
	return a, b
}

func parent(i int) int { return i / 2 }

// Add a new list to the merge set
func (t *Tree[E]) Push(list []E) {
	// First, see if we can replace one that was previously finished.
	for newPos := len(t.nodes) / 2; newPos < len(t.nodes); newPos++ {
		if t.nodes[newPos].index == -1 {
			t.nodes[newPos].index = newPos
			t.nodes[newPos].items = list
			t.moveNext(newPos)
			t.nodes[0].index = -1 // flag for re-initialize on next call to Next()
			return
		}
	}
	// We need to expand the tree. Pick the next biggest power of 2 to amortise resizing cost.
	size := 1
	for size <= len(t.nodes)/2 {
		size *= 2
	}
	newPos := size + len(t.nodes)/2
	newNodes := make([]node[E], size*2)
	// Copy data over and fix up the indexes.
	for i, n := range t.nodes[len(t.nodes)/2:] {
		newNodes[i+size] = n
		newNodes[i+size].index = i + size
	}
	t.nodes = newNodes
	t.nodes[newPos].index = newPos
	t.nodes[newPos].items = list
	// Mark all the empty nodes we have added as finished.
	for i := newPos + 1; i < len(t.nodes); i++ {
		t.nodes[i].index = -1
		t.nodes[i].value = t.maxVal
	}
	t.moveNext(newPos)
	t.nodes[0].index = -1 // flag for re-initialize on next call to Next()
}
