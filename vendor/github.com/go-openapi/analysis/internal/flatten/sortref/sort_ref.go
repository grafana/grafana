package sortref

import (
	"reflect"
	"sort"
	"strings"

	"github.com/go-openapi/analysis/internal/flatten/normalize"
	"github.com/go-openapi/spec"
)

var depthGroupOrder = []string{
	"sharedParam", "sharedResponse", "sharedOpParam", "opParam", "codeResponse", "defaultResponse", "definition",
}

type mapIterator struct {
	len     int
	mapIter *reflect.MapIter
}

func (i *mapIterator) Next() bool {
	return i.mapIter.Next()
}

func (i *mapIterator) Len() int {
	return i.len
}

func (i *mapIterator) Key() string {
	return i.mapIter.Key().String()
}

func mustMapIterator(anyMap interface{}) *mapIterator {
	val := reflect.ValueOf(anyMap)

	return &mapIterator{mapIter: val.MapRange(), len: val.Len()}
}

// DepthFirst sorts a map of anything. It groups keys by category
// (shared params, op param, statuscode response, default response, definitions)
// sort groups internally by number of parts in the key and lexical names
// flatten groups into a single list of keys
func DepthFirst(in interface{}) []string {
	iterator := mustMapIterator(in)
	sorted := make([]string, 0, iterator.Len())
	grouped := make(map[string]Keys, iterator.Len())

	for iterator.Next() {
		k := iterator.Key()
		split := KeyParts(k)
		var pk string

		if split.IsSharedOperationParam() {
			pk = "sharedOpParam"
		}
		if split.IsOperationParam() {
			pk = "opParam"
		}
		if split.IsStatusCodeResponse() {
			pk = "codeResponse"
		}
		if split.IsDefaultResponse() {
			pk = "defaultResponse"
		}
		if split.IsDefinition() {
			pk = "definition"
		}
		if split.IsSharedParam() {
			pk = "sharedParam"
		}
		if split.IsSharedResponse() {
			pk = "sharedResponse"
		}
		grouped[pk] = append(grouped[pk], Key{Segments: len(split), Key: k})
	}

	for _, pk := range depthGroupOrder {
		res := grouped[pk]
		sort.Sort(res)

		for _, v := range res {
			sorted = append(sorted, v.Key)
		}
	}

	return sorted
}

// topMostRefs is able to sort refs by hierarchical then lexicographic order,
// yielding refs ordered breadth-first.
type topmostRefs []string

func (k topmostRefs) Len() int      { return len(k) }
func (k topmostRefs) Swap(i, j int) { k[i], k[j] = k[j], k[i] }
func (k topmostRefs) Less(i, j int) bool {
	li, lj := len(strings.Split(k[i], "/")), len(strings.Split(k[j], "/"))
	if li == lj {
		return k[i] < k[j]
	}

	return li < lj
}

// TopmostFirst sorts references by depth
func TopmostFirst(refs []string) []string {
	res := topmostRefs(refs)
	sort.Sort(res)

	return res
}

// RefRevIdx is a reverse index for references
type RefRevIdx struct {
	Ref  spec.Ref
	Keys []string
}

// ReverseIndex builds a reverse index for references in schemas
func ReverseIndex(schemas map[string]spec.Ref, basePath string) map[string]RefRevIdx {
	collected := make(map[string]RefRevIdx)
	for key, schRef := range schemas {
		// normalize paths before sorting,
		// so we get together keys that are from the same external file
		normalizedPath := normalize.Path(schRef, basePath)

		entry, ok := collected[normalizedPath]
		if ok {
			entry.Keys = append(entry.Keys, key)
			collected[normalizedPath] = entry

			continue
		}

		collected[normalizedPath] = RefRevIdx{
			Ref:  schRef,
			Keys: []string{key},
		}
	}

	return collected
}
