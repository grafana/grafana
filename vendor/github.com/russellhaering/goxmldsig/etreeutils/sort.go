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

	// Wow. We're still going. Finally, attributes in the same namespace should be
	// sorted by key. Attributes in different namespaces should be sorted by the
	// actual namespace (_not_ the prefix). For now just use the prefix.
	if a[i].Space == a[j].Space {
		return a[i].Key < a[j].Key
	}

	return a[i].Space < a[j].Space
}
