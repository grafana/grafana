package xml

// mapEntryWrapper is the default member wrapper start element for XML Map entry
var mapEntryWrapper = StartElement{
	Name: Name{Local: "entry"},
}

// Map represents the encoding of a XML map type
type Map struct {
	w       writer
	scratch *[]byte

	// member start element is the map entry wrapper start element
	memberStartElement StartElement

	// isFlattened returns true if the map is a flattened map
	isFlattened bool
}

// newMap returns a map encoder which sets the default map
// entry wrapper to `entry`.
//
// A map `someMap : {{key:"abc", value:"123"}}` is represented as
// `<someMap><entry><key>abc<key><value>123</value></entry></someMap>`.
func newMap(w writer, scratch *[]byte) *Map {
	return &Map{
		w:                  w,
		scratch:            scratch,
		memberStartElement: mapEntryWrapper,
	}
}

// newFlattenedMap returns a map encoder which sets the map
// entry wrapper to the passed in memberWrapper`.
//
// A flattened map `someMap : {{key:"abc", value:"123"}}` is represented as
// `<someMap><key>abc<key><value>123</value></someMap>`.
func newFlattenedMap(w writer, scratch *[]byte, memberWrapper StartElement) *Map {
	return &Map{
		w:                  w,
		scratch:            scratch,
		memberStartElement: memberWrapper,
		isFlattened:        true,
	}
}

// Entry returns a Value encoder with map's element.
// It writes the member wrapper start tag for each entry.
func (m *Map) Entry() Value {
	v := newValue(m.w, m.scratch, m.memberStartElement)
	v.isFlattened = m.isFlattened
	return v
}
