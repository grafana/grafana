package dsig

import (
	"sort"

	"github.com/beevik/etree"
	"github.com/russellhaering/goxmldsig/etreeutils"
)

// Canonicalizer is an implementation of a canonicalization algorithm.
type Canonicalizer interface {
	Canonicalize(el *etree.Element) ([]byte, error)
	Algorithm() AlgorithmID
}

type c14N10ExclusiveCanonicalizer struct {
	prefixList string
}

// MakeC14N10ExclusiveCanonicalizerWithPrefixList constructs an exclusive Canonicalizer
// from a PrefixList in NMTOKENS format (a white space separated list).
func MakeC14N10ExclusiveCanonicalizerWithPrefixList(prefixList string) Canonicalizer {
	return &c14N10ExclusiveCanonicalizer{
		prefixList: prefixList,
	}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N10ExclusiveCanonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	err := etreeutils.TransformExcC14n(el, c.prefixList)
	if err != nil {
		return nil, err
	}

	return canonicalSerialize(el)
}

func (c *c14N10ExclusiveCanonicalizer) Algorithm() AlgorithmID {
	return CanonicalXML10ExclusiveAlgorithmId
}

type c14N11Canonicalizer struct{}

// MakeC14N11Canonicalizer constructs an inclusive canonicalizer.
func MakeC14N11Canonicalizer() Canonicalizer {
	return &c14N11Canonicalizer{}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N11Canonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	scope := make(map[string]struct{})
	return canonicalSerialize(canonicalPrep(el, scope))
}

func (c *c14N11Canonicalizer) Algorithm() AlgorithmID {
	return CanonicalXML11AlgorithmId
}

type c14N10RecCanonicalizer struct{}

// MakeC14N10RecCanonicalizer constructs an inclusive canonicalizer.
func MakeC14N10RecCanonicalizer() Canonicalizer {
	return &c14N10RecCanonicalizer{}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N10RecCanonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	scope := make(map[string]struct{})
	return canonicalSerialize(canonicalPrep(el, scope))
}

func (c *c14N10RecCanonicalizer) Algorithm() AlgorithmID {
	return CanonicalXML10RecAlgorithmId
}

type c14N10CommentCanonicalizer struct{}

// MakeC14N10CommentCanonicalizer constructs an inclusive canonicalizer.
func MakeC14N10CommentCanonicalizer() Canonicalizer {
	return &c14N10CommentCanonicalizer{}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N10CommentCanonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	scope := make(map[string]struct{})
	return canonicalSerialize(canonicalPrep(el, scope))
}

func (c *c14N10CommentCanonicalizer) Algorithm() AlgorithmID {
	return CanonicalXML10CommentAlgorithmId
}

func composeAttr(space, key string) string {
	if space != "" {
		return space + ":" + key
	}

	return key
}

type c14nSpace struct {
	a    etree.Attr
	used bool
}

const nsSpace = "xmlns"

// canonicalPrep accepts an *etree.Element and transforms it into one which is ready
// for serialization into inclusive canonical form. Specifically this
// entails:
//
// 1. Stripping re-declarations of namespaces
// 2. Sorting attributes into canonical order
//
// Inclusive canonicalization does not strip unused namespaces.
//
// TODO(russell_h): This is very similar to excCanonicalPrep - perhaps they should
// be unified into one parameterized function?
func canonicalPrep(el *etree.Element, seenSoFar map[string]struct{}) *etree.Element {
	_seenSoFar := make(map[string]struct{})
	for k, v := range seenSoFar {
		_seenSoFar[k] = v
	}

	ne := el.Copy()
	sort.Sort(etreeutils.SortedAttrs(ne.Attr))
	if len(ne.Attr) != 0 {
		for _, attr := range ne.Attr {
			if attr.Space != nsSpace {
				continue
			}
			key := attr.Space + ":" + attr.Key
			if _, seen := _seenSoFar[key]; seen {
				ne.RemoveAttr(attr.Space + ":" + attr.Key)
			} else {
				_seenSoFar[key] = struct{}{}
			}
		}
	}

	for i, token := range ne.Child {
		childElement, ok := token.(*etree.Element)
		if ok {
			ne.Child[i] = canonicalPrep(childElement, _seenSoFar)
		}
	}

	return ne
}

func canonicalSerialize(el *etree.Element) ([]byte, error) {
	doc := etree.NewDocument()
	doc.SetRoot(el.Copy())

	doc.WriteSettings = etree.WriteSettings{
		CanonicalAttrVal: true,
		CanonicalEndTags: true,
		CanonicalText:    true,
	}

	return doc.WriteToBytes()
}
