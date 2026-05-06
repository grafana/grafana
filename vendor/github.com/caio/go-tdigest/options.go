package tdigest

import "errors"

type tdigestOption func(*TDigest) error

// Compression sets the digest compression
//
// The compression parameter rules the threshold in which samples are
// merged together - the more often distinct samples are merged the more
// precision is lost. Compression should be tuned according to your data
// distribution, but a value of 100 (the default) is often good enough.
//
// A higher compression value means holding more centroids in memory
// (thus: better precision), which means a bigger serialization payload,
// higher memory footprint and slower addition of new samples.
//
// Compression must be a value greater of equal to 1, will yield an
// error otherwise.
func Compression(compression float64) tdigestOption { // nolint
	return func(t *TDigest) error {
		if compression < 1 {
			return errors.New("Compression should be >= 1")
		}
		t.compression = compression
		return nil
	}
}

// RandomNumberGenerator sets the RNG to be used internally
//
// This allows changing which random number source is used when using
// the TDigest structure (rngs are used when deciding which candidate
// centroid to merge with and when compressing or merging with
// another digest for it increases accuracy). This functionality is
// particularly useful for testing or when you want to disconnect
// your sample collection from the (default) shared random source
// to minimize lock contention.
func RandomNumberGenerator(rng RNG) tdigestOption { // nolint
	return func(t *TDigest) error {
		t.rng = rng
		return nil
	}
}

// LocalRandomNumberGenerator makes the TDigest use the default
// `math/random` functions but with an unshared source that is
// seeded with the given `seed` parameter.
func LocalRandomNumberGenerator(seed int64) tdigestOption { // nolint
	return RandomNumberGenerator(newLocalRNG(seed))
}
