package dst

// NodeDecs holds the decorations that are common to all nodes (except Package).
type NodeDecs struct {
	Before SpaceType
	Start  Decorations
	End    Decorations
	After  SpaceType
}

// Decorations is a slice of strings which are rendered with the node. Decorations can be comments (starting "//" or "/*") or newlines ("\n").
type Decorations []string

// Append adds one or more decorations to the end of the list.
func (d *Decorations) Append(decs ...string) {
	*d = append(*d, decs...)
}

// Prepend adds one or more decorations to the start of the list.
func (d *Decorations) Prepend(decs ...string) {
	*d = append(append([]string{}, decs...), *d...) // ensure we don't modify decs
}

// Replace replaces all decorations with decs.
func (d *Decorations) Replace(decs ...string) {
	*d = append([]string{}, decs...) // ensure we don't modify decs
}

// Clear removes all decorations from this item
func (d *Decorations) Clear() {
	*d = nil
}

// All returns the decorations as a string slice
func (d *Decorations) All() []string {
	return *d
}

// SpaceType represents the line spacing before or after a node. When the start of one node is
// adjacent to the end of another node, the SpaceType values are not additive (e.g. two NewLines
// will render a NewLine and not an EmptyLine).
type SpaceType int

const (
	None      SpaceType = 0 // None means no extra spacing.
	NewLine   SpaceType = 1 // NewLine is a single "\n"
	EmptyLine SpaceType = 2 // EmptyLine is a double "\n"
)

// String returns a human readable representation of the space type
func (s SpaceType) String() string {
	switch s {
	case None:
		return "None"
	case NewLine:
		return "NewLine"
	case EmptyLine:
		return "EmptyLine"
	}
	return ""
}
