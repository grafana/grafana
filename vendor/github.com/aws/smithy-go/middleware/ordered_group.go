package middleware

import "fmt"

// RelativePosition provides specifying the relative position of a middleware
// in an ordered group.
type RelativePosition int

// Relative position for middleware in steps.
const (
	After RelativePosition = iota
	Before
)

type ider interface {
	ID() string
}

// orderedIDs provides an ordered collection of items with relative ordering
// by name.
type orderedIDs struct {
	order *relativeOrder
	items map[string]ider
}

// selected based on the general upper bound of # of middlewares in each step
// in the downstream aws-sdk-go-v2
const baseOrderedItems = 8

func newOrderedIDs(cap int) *orderedIDs {
	return &orderedIDs{
		order: newRelativeOrder(cap),
		items: make(map[string]ider, cap),
	}
}

// Add injects the item to the relative position of the item group. Returns an
// error if the item already exists.
func (g *orderedIDs) Add(m ider, pos RelativePosition) error {
	id := m.ID()
	if len(id) == 0 {
		return fmt.Errorf("empty ID, ID must not be empty")
	}

	if err := g.order.Add(pos, id); err != nil {
		return err
	}

	g.items[id] = m
	return nil
}

// Insert injects the item relative to an existing item id. Returns an error if
// the original item does not exist, or the item being added already exists.
func (g *orderedIDs) Insert(m ider, relativeTo string, pos RelativePosition) error {
	if len(m.ID()) == 0 {
		return fmt.Errorf("insert ID must not be empty")
	}
	if len(relativeTo) == 0 {
		return fmt.Errorf("relative to ID must not be empty")
	}

	if err := g.order.Insert(relativeTo, pos, m.ID()); err != nil {
		return err
	}

	g.items[m.ID()] = m
	return nil
}

// Get returns the ider identified by id. If ider is not present, returns false.
func (g *orderedIDs) Get(id string) (ider, bool) {
	v, ok := g.items[id]
	return v, ok
}

// Swap removes the item by id, replacing it with the new item. Returns an error
// if the original item doesn't exist.
func (g *orderedIDs) Swap(id string, m ider) (ider, error) {
	if len(id) == 0 {
		return nil, fmt.Errorf("swap from ID must not be empty")
	}

	iderID := m.ID()
	if len(iderID) == 0 {
		return nil, fmt.Errorf("swap to ID must not be empty")
	}

	if err := g.order.Swap(id, iderID); err != nil {
		return nil, err
	}

	removed := g.items[id]

	delete(g.items, id)
	g.items[iderID] = m

	return removed, nil
}

// Remove removes the item by id. Returns an error if the item
// doesn't exist.
func (g *orderedIDs) Remove(id string) (ider, error) {
	if len(id) == 0 {
		return nil, fmt.Errorf("remove ID must not be empty")
	}

	if err := g.order.Remove(id); err != nil {
		return nil, err
	}

	removed := g.items[id]
	delete(g.items, id)
	return removed, nil
}

func (g *orderedIDs) List() []string {
	items := g.order.List()
	order := make([]string, len(items))
	copy(order, items)
	return order
}

// Clear removes all entries and slots.
func (g *orderedIDs) Clear() {
	g.order.Clear()
	g.items = map[string]ider{}
}

// GetOrder returns the item in the order it should be invoked in.
func (g *orderedIDs) GetOrder() []interface{} {
	order := g.order.List()
	ordered := make([]interface{}, len(order))
	for i := 0; i < len(order); i++ {
		ordered[i] = g.items[order[i]]
	}

	return ordered
}

// relativeOrder provides ordering of item
type relativeOrder struct {
	order []string
}

func newRelativeOrder(cap int) *relativeOrder {
	return &relativeOrder{
		order: make([]string, 0, cap),
	}
}

// Add inserts an item into the order relative to the position provided.
func (s *relativeOrder) Add(pos RelativePosition, ids ...string) error {
	if len(ids) == 0 {
		return nil
	}

	for _, id := range ids {
		if _, ok := s.has(id); ok {
			return fmt.Errorf("already exists, %v", id)
		}
	}

	switch pos {
	case Before:
		return s.insert(0, Before, ids...)

	case After:
		s.order = append(s.order, ids...)

	default:
		return fmt.Errorf("invalid position, %v", int(pos))
	}

	return nil
}

// Insert injects an item before or after the relative item. Returns
// an error if the relative item does not exist.
func (s *relativeOrder) Insert(relativeTo string, pos RelativePosition, ids ...string) error {
	if len(ids) == 0 {
		return nil
	}

	for _, id := range ids {
		if _, ok := s.has(id); ok {
			return fmt.Errorf("already exists, %v", id)
		}
	}

	i, ok := s.has(relativeTo)
	if !ok {
		return fmt.Errorf("not found, %v", relativeTo)
	}

	return s.insert(i, pos, ids...)
}

// Swap will replace the item id with the to item. Returns an
// error if the original item id does not exist. Allows swapping out an
// item for another item with the same id.
func (s *relativeOrder) Swap(id, to string) error {
	i, ok := s.has(id)
	if !ok {
		return fmt.Errorf("not found, %v", id)
	}

	if _, ok = s.has(to); ok && id != to {
		return fmt.Errorf("already exists, %v", to)
	}

	s.order[i] = to
	return nil
}

func (s *relativeOrder) Remove(id string) error {
	i, ok := s.has(id)
	if !ok {
		return fmt.Errorf("not found, %v", id)
	}

	s.order = append(s.order[:i], s.order[i+1:]...)
	return nil
}

func (s *relativeOrder) List() []string {
	return s.order
}

func (s *relativeOrder) Clear() {
	s.order = s.order[0:0]
}

func (s *relativeOrder) insert(i int, pos RelativePosition, ids ...string) error {
	switch pos {
	case Before:
		n := len(ids)
		var src []string
		if n <= cap(s.order)-len(s.order) {
			s.order = s.order[:len(s.order)+n]
			src = s.order
		} else {
			src = s.order
			s.order = make([]string, len(s.order)+n)
			copy(s.order[:i], src[:i]) // only when allocating a new slice do we need to copy the front half
		}
		copy(s.order[i+n:], src[i:])
		copy(s.order[i:], ids)
	case After:
		if i == len(s.order)-1 || len(s.order) == 0 {
			s.order = append(s.order, ids...)
		} else {
			s.order = append(s.order[:i+1], append(ids, s.order[i+1:]...)...)
		}

	default:
		return fmt.Errorf("invalid position, %v", int(pos))
	}

	return nil
}

func (s *relativeOrder) has(id string) (i int, found bool) {
	for i := 0; i < len(s.order); i++ {
		if s.order[i] == id {
			return i, true
		}
	}
	return 0, false
}
