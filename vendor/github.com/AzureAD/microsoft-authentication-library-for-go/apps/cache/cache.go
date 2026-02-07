// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/*
Package cache allows third parties to implement external storage for caching token data
for distributed systems or multiple local applications access.

The data stored and extracted will represent the entire cache. Therefore it is recommended
one msal instance per user. This data is considered opaque and there are no guarantees to
implementers on the format being passed.
*/
package cache

import "context"

// Marshaler marshals data from an internal cache to bytes that can be stored.
type Marshaler interface {
	Marshal() ([]byte, error)
}

// Unmarshaler unmarshals data from a storage medium into the internal cache, overwriting it.
type Unmarshaler interface {
	Unmarshal([]byte) error
}

// Serializer can serialize the cache to binary or from binary into the cache.
type Serializer interface {
	Marshaler
	Unmarshaler
}

// ExportHints are suggestions for storing data.
type ExportHints struct {
	// PartitionKey is a suggested key for partitioning the cache
	PartitionKey string
}

// ReplaceHints are suggestions for loading data.
type ReplaceHints struct {
	// PartitionKey is a suggested key for partitioning the cache
	PartitionKey string
}

// ExportReplace exports and replaces in-memory cache data. It doesn't support nil Context or
// define the outcome of passing one. A Context without a timeout must receive a default timeout
// specified by the implementor. Retries must be implemented inside the implementation.
type ExportReplace interface {
	// Replace replaces the cache with what is in external storage. Implementors should honor
	// Context cancellations and return context.Canceled or context.DeadlineExceeded in those cases.
	Replace(ctx context.Context, cache Unmarshaler, hints ReplaceHints) error
	// Export writes the binary representation of the cache (cache.Marshal()) to external storage.
	// This is considered opaque. Context cancellations should be honored as in Replace.
	Export(ctx context.Context, cache Marshaler, hints ExportHints) error
}
