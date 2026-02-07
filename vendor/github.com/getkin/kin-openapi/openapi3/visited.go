package openapi3

func newVisited() visitedComponent {
	return visitedComponent{
		header: make(map[*Header]struct{}),
		schema: make(map[*Schema]struct{}),
	}
}

type visitedComponent struct {
	header map[*Header]struct{}
	schema map[*Schema]struct{}
}

// resetVisited clears visitedComponent map
// should be called before recursion over doc *T
func (doc *T) resetVisited() {
	doc.visited = newVisited()
}

// isVisitedHeader returns `true` if the *Header pointer was already visited
// otherwise it returns `false`
func (doc *T) isVisitedHeader(h *Header) bool {
	if _, ok := doc.visited.header[h]; ok {
		return true
	}

	doc.visited.header[h] = struct{}{}
	return false
}

// isVisitedHeader returns `true` if the *Schema pointer was already visited
// otherwise it returns `false`
func (doc *T) isVisitedSchema(s *Schema) bool {
	if _, ok := doc.visited.schema[s]; ok {
		return true
	}

	doc.visited.schema[s] = struct{}{}
	return false
}
