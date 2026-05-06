package convert

import (
	"github.com/zclconf/go-cty/cty"
)

// sortTypes produces an ordering of the given types that serves as a
// preference order for the result of unification of the given types.
// The return value is a slice of indices into the given slice, and will
// thus always be the same length as the given slice.
//
// The goal is that the most general of the given types will appear first
// in the ordering. If there are uncomparable pairs of types in the list
// then they will appear in an undefined order, and the unification pass
// will presumably then fail.
func sortTypes(tys []cty.Type) []int {
	l := len(tys)

	// First we build a graph whose edges represent "more general than",
	// which we will then do a topological sort of.
	edges := make([][]int, l)
	for i := 0; i < (l - 1); i++ {
		for j := i + 1; j < l; j++ {
			cmp := compareTypes(tys[i], tys[j])
			switch {
			case cmp < 0:
				edges[i] = append(edges[i], j)
			case cmp > 0:
				edges[j] = append(edges[j], i)
			}
		}
	}

	// Compute the in-degree of each node
	inDegree := make([]int, l)
	for _, outs := range edges {
		for _, j := range outs {
			inDegree[j]++
		}
	}

	// The array backing our result will double as our queue for visiting
	// the nodes, with the queue slice moving along this array until it
	// is empty and positioned at the end of the array. Thus our visiting
	// order is also our result order.
	result := make([]int, l)
	queue := result[0:0]

	// Initialize the queue with any item of in-degree 0, preserving
	// their relative order.
	for i, n := range inDegree {
		if n == 0 {
			queue = append(queue, i)
		}
	}

	for len(queue) != 0 {
		i := queue[0]
		queue = queue[1:]
		for _, j := range edges[i] {
			inDegree[j]--
			if inDegree[j] == 0 {
				queue = append(queue, j)
			}
		}
	}

	return result
}
