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

type NullCanonicalizer struct {
}

func MakeNullCanonicalizer() Canonicalizer {
	return &NullCanonicalizer{}
}

func (c *NullCanonicalizer) Algorithm() AlgorithmID {
	return AlgorithmID("NULL")
}

func (c *NullCanonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	return canonicalSerialize(canonicalPrep(el, false, true))
}

type c14N10ExclusiveCanonicalizer struct {
	prefixList string
	comments   bool
}

// MakeC14N10ExclusiveCanonicalizerWithPrefixList constructs an exclusive Canonicalizer
// from a PrefixList in NMTOKENS format (a white space separated list).
func MakeC14N10ExclusiveCanonicalizerWithPrefixList(prefixList string) Canonicalizer {
	return &c14N10ExclusiveCanonicalizer{
		prefixList: prefixList,
		comments:   false,
	}
}

// MakeC14N10ExclusiveWithCommentsCanonicalizerWithPrefixList constructs an exclusive Canonicalizer
// from a PrefixList in NMTOKENS format (a white space separated list).
func MakeC14N10ExclusiveWithCommentsCanonicalizerWithPrefixList(prefixList string) Canonicalizer {
	return &c14N10ExclusiveCanonicalizer{
		prefixList: prefixList,
		comments:   true,
	}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N10ExclusiveCanonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	err := etreeutils.TransformExcC14n(el, c.prefixList, c.comments)
	if err != nil {
		return nil, err
	}

	return canonicalSerialize(el)
}

func (c *c14N10ExclusiveCanonicalizer) Algorithm() AlgorithmID {
	if c.comments {
		return CanonicalXML10ExclusiveWithCommentsAlgorithmId
	}
	return CanonicalXML10ExclusiveAlgorithmId
}

type c14N11Canonicalizer struct {
	comments bool
}

// MakeC14N11Canonicalizer constructs an inclusive canonicalizer.
func MakeC14N11Canonicalizer() Canonicalizer {
	return &c14N11Canonicalizer{
		comments: false,
	}
}

// MakeC14N11WithCommentsCanonicalizer constructs an inclusive canonicalizer.
func MakeC14N11WithCommentsCanonicalizer() Canonicalizer {
	return &c14N11Canonicalizer{
		comments: true,
	}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N11Canonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	return canonicalSerialize(canonicalPrep(el, true, c.comments))
}

func (c *c14N11Canonicalizer) Algorithm() AlgorithmID {
	if c.comments {
		return CanonicalXML11WithCommentsAlgorithmId
	}
	return CanonicalXML11AlgorithmId
}

type c14N10RecCanonicalizer struct {
	comments bool
}

// MakeC14N10RecCanonicalizer constructs an inclusive canonicalizer.
func MakeC14N10RecCanonicalizer() Canonicalizer {
	return &c14N10RecCanonicalizer{
		comments: false,
	}
}

// MakeC14N10WithCommentsCanonicalizer constructs an inclusive canonicalizer.
func MakeC14N10WithCommentsCanonicalizer() Canonicalizer {
	return &c14N10RecCanonicalizer{
		comments: true,
	}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N10RecCanonicalizer) Canonicalize(inputXML *etree.Element) ([]byte, error) {
	parentNamespaceAttributes, parentXmlAttributes := getParentNamespaceAndXmlAttributes(inputXML)
	inputXMLCopy := inputXML.Copy()
	enhanceNamespaceAttributes(inputXMLCopy, parentNamespaceAttributes, parentXmlAttributes)
	return canonicalSerialize(canonicalPrep(inputXMLCopy, true, c.comments))
}

func (c *c14N10RecCanonicalizer) Algorithm() AlgorithmID {
	if c.comments {
		return CanonicalXML10WithCommentsAlgorithmId
	}
	return CanonicalXML10RecAlgorithmId

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
func canonicalPrep(el *etree.Element, strip bool, comments bool) *etree.Element {
	return canonicalPrepInner(el, make(map[string]string), strip, comments)
}

func canonicalPrepInner(el *etree.Element, seenSoFar map[string]string, strip bool, comments bool) *etree.Element {
	_seenSoFar := make(map[string]string)
	for k, v := range seenSoFar {
		_seenSoFar[k] = v
	}

	ne := el.Copy()
	sort.Sort(etreeutils.SortedAttrs(ne.Attr))
	n := 0
	for _, attr := range ne.Attr {
		if attr.Space != nsSpace && !(attr.Space == "" && attr.Key == nsSpace) {
			ne.Attr[n] = attr
			n++
			continue
		}

		if attr.Space == nsSpace {
			key := attr.Space + ":" + attr.Key
			if uri, seen := _seenSoFar[key]; !seen || attr.Value != uri {
				ne.Attr[n] = attr
				n++
				_seenSoFar[key] = attr.Value
			}
		} else {
			if uri, seen := _seenSoFar[nsSpace]; (!seen && attr.Value != "") || attr.Value != uri {
				ne.Attr[n] = attr
				n++
				_seenSoFar[nsSpace] = attr.Value
			}
		}
	}
	ne.Attr = ne.Attr[:n]

	if !comments {
		c := 0
		for c < len(ne.Child) {
			if _, ok := ne.Child[c].(*etree.Comment); ok {
				ne.RemoveChildAt(c)
			} else {
				c++
			}
		}
	}

	for i, token := range ne.Child {
		childElement, ok := token.(*etree.Element)
		if ok {
			ne.Child[i] = canonicalPrepInner(childElement, _seenSoFar, strip, comments)
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

func getParentNamespaceAndXmlAttributes(el *etree.Element) (map[string]string, map[string]string) {
	namespaceMap := make(map[string]string, 23)
	xmlMap := make(map[string]string, 5)
	parents := make([]*etree.Element, 0, 23)
	n1 := el.Parent()
	if n1 == nil {
		return namespaceMap, xmlMap
	}
	parent := n1
	for parent != nil {
		parents = append(parents, parent)
		parent = parent.Parent()
	}
	for i := len(parents) - 1; i > -1; i-- {
		elementPos := parents[i]
		for _, attr := range elementPos.Attr {
			if attr.Space == "xmlns" && (attr.Key != "xml" || attr.Value != "http://www.w3.org/XML/1998/namespace") {
				namespaceMap[attr.Key] = attr.Value
			} else if attr.Space == "" && attr.Key == "xmlns" {
				namespaceMap[attr.Key] = attr.Value
			} else if attr.Space == "xml" {
				xmlMap[attr.Key] = attr.Value
			}
		}
	}
	return namespaceMap, xmlMap
}

func enhanceNamespaceAttributes(el *etree.Element, parentNamespaces map[string]string, parentXmlAttributes map[string]string) {
	for prefix, uri := range parentNamespaces {
		if prefix == "xmlns" {
			el.CreateAttr("xmlns", uri)
		} else {
			el.CreateAttr("xmlns:"+prefix, uri)
		}
	}
	for attr, value := range parentXmlAttributes {
		el.CreateAttr("xml:"+attr, value)
	}
}
