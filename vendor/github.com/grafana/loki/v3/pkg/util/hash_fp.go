package util

import (
	"hash/fnv"

	"github.com/prometheus/common/model"
)

// HashFP simply moves entropy from the most significant 48 bits of the
// fingerprint into the least significant 16 bits (by XORing) so that a simple
// MOD on the result can be used to pick a mutex while still making use of
// changes in more significant bits of the fingerprint. (The fast fingerprinting
// function we use is prone to only change a few bits for similar metrics. We
// really want to make use of every change in the fingerprint to vary mutex
// selection.)
func HashFP(fp model.Fingerprint) uint32 {
	return uint32(fp ^ (fp >> 32) ^ (fp >> 16))
}

// HashedQuery returns a unique hash value for the given `query`.
func HashedQuery(query string) uint32 {
	h := fnv.New32()
	_, _ = h.Write([]byte(query))
	return h.Sum32()
}
