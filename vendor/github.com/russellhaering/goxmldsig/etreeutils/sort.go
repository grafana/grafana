package etreeutils

import "github.com/beevik/etree"

// SortedAttrs provides sorting capabilities, compatible with XML C14N, on top
// of an []etree.Attr
type SortedAttrs []etree.Attr

func (a SortedAttrs) Len() int {
	return len(a)
}

func (a SortedAttrs) Swap(i, j int) {
	a[i], a[j] = a[j], a[i]
}

func (a SortedAttrs) Less(i, j int) bool {
	// This is the best reference I've found on sort order:
	// http://dst.lbl.gov/~ksb/Scratch/XMLC14N.html

	// If attr j is a default namespace declaration, attr i may
	// not be strictly "less" than it.
	if a[j].Space == defaultPrefix && a[j].Key == xmlnsPrefix {
		return false
	}

	// Otherwise, if attr i is a default namespace declaration, it
	// must be less than anything else.
	if a[i].Space == defaultPrefix && a[i].Key == xmlnsPrefix {
		return true
	}

	// Next, namespace prefix declarations, sorted by prefix, come before
	// anythign else.
	if a[i].Space == xmlnsPrefix {
		if a[j].Space == xmlnsPrefix {
			return a[i].Key < a[j].Key
		}
		return true
	}

	if a[j].Space == xmlnsPrefix {
		return false
	}

	// Then come unprefixed attributes, sorted by key.
	if a[i].Space == defaultPrefix {
		if a[j].Space == defaultPrefix {
			return a[i].Key < a[j].Key
		}
		return true
	}

	if a[j].Space == defaultPrefix {
		return false
	}

	// Attributes with the same prefix should be sorted by their keys.
	if a[i].Space == a[j].Space {
		return a[i].Key < a[j].Key
	}

	// Attributes in the same namespace are sorted by their Namespace URI, not the prefix.
	// NOTE: This implementation is not complete because it does not consider namespace
	// prefixes declared in ancestor elements. A complete solution would ideally use the
	// Attribute.NamespaceURI() method obtain a namespace URI for sorting, but the
	// beevik/etree library needs to be fixed to provide the correct value first.
	if a[i].Key == a[j].Key {
		var leftNS, rightNS etree.Attr
		for n := range a {
			if a[i].Space == a[n].Key {
				leftNS = a[n]
			}
			if a[j].Space == a[n].Key {
				rightNS = a[n]
			}
		}
		// Sort based on the NS URIs
		return leftNS.Value < rightNS.Value
	}

	return a[i].Key < a[j].Key
}
