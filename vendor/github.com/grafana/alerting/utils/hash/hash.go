package hash

import (
	"hash"

	"github.com/davecgh/go-spew/spew"
)

var configForHash = &spew.ConfigState{
	Indent:                  " ",
	SortKeys:                true,
	DisableMethods:          true,
	SpewKeys:                true,
	DisablePointerAddresses: true,
	DisableCapacities:       true,
}

// DeepHashObject writes specified object to hash using the spew library
// which follows pointers and prints actual values of the nested objects
// ensuring the hash does not change when a pointer changes.
func DeepHashObject(hasher hash.Hash, objectToWrite any) {
	hasher.Reset()
	configForHash.Fprintf(hasher, "%#v", objectToWrite)
}

// Dump serializes any object into a detailed string representation using a predefined configuration that is used for calculating the hash.
// Useful for debugging hash calculation
func Dump(objectToWrite any) string {
	return configForHash.Sprintf("%#v", objectToWrite)
}
