package utils

import "hash/fnv"

// Hash is taking a string and convert.
func Hash(s string) uint32 {
	h := fnv.New32a()
	_, err := h.Write([]byte(s))
	// if we have a problem to get the hash we return 0
	if err != nil {
		return 0
	}
	return h.Sum32()
}

// BuildHash is building the hash based on the different properties of the evaluation.
func BuildHash(flagName string, bucketingKey string, maxPercentage uint32) uint32 {
	// this is not supposed to happen, but to avoid a crash if maxPercentage is 0 we are returning 0
	if maxPercentage == uint32(0) {
		return uint32(0)
	}
	return Hash(flagName+bucketingKey) % maxPercentage
}
