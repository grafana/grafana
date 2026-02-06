// Copyright (c) The go-grpc-middleware Authors.
// Licensed under the Apache License 2.0.

package metadata

import (
	"context"
	"strings"

	grpcMetadata "google.golang.org/grpc/metadata"
)

// MD is a convenience wrapper defining extra functions on the metadata.
type MD grpcMetadata.MD

// ExtractIncoming extracts an inbound metadata from the server-side context.
//
// This function always returns a MD wrapper of the grpcMetadata.MD, in case the context doesn't have metadata it returns
// a new empty MD.
func ExtractIncoming(ctx context.Context) MD {
	md, ok := grpcMetadata.FromIncomingContext(ctx)
	if !ok {
		return MD(grpcMetadata.Pairs())
	}
	return MD(md)
}

// ExtractOutgoing extracts an outbound metadata from the client-side context.
//
// This function always returns a MD wrapper of the grpcMetadata.MD, in case the context doesn't have metadata it returns
// a new empty MD.
func ExtractOutgoing(ctx context.Context) MD {
	md, ok := grpcMetadata.FromOutgoingContext(ctx)
	if !ok {
		return MD(grpcMetadata.Pairs())
	}
	return MD(md)
}

// Clone performs a *deep* copy of the grpcMetadata.MD.
//
// You can specify the lower-case copiedKeys to only copy certain whitelisted keys. If no keys are explicitly whitelisted
// all keys get copied.
func (m MD) Clone(copiedKeys ...string) MD {
	newMd := MD(grpcMetadata.Pairs())
	for k, vv := range m {
		found := false
		if len(copiedKeys) == 0 {
			found = true
		} else {
			for _, allowedKey := range copiedKeys {
				if strings.EqualFold(allowedKey, k) {
					found = true
					break
				}
			}
		}
		if !found {
			continue
		}
		newMd[k] = make([]string, len(vv))
		copy(newMd[k], vv)
	}
	return newMd
}

// ToOutgoing sets the given MD as a client-side context for dispatching.
func (m MD) ToOutgoing(ctx context.Context) context.Context {
	return grpcMetadata.NewOutgoingContext(ctx, grpcMetadata.MD(m))
}

// ToIncoming sets the given MD as a server-side context for dispatching.
//
// This is mostly useful in ServerInterceptors.
func (m MD) ToIncoming(ctx context.Context) context.Context {
	return grpcMetadata.NewIncomingContext(ctx, grpcMetadata.MD(m))
}

// Get retrieves a single value from the metadata.
//
// It works analogously to http.Header.Get, returning the first value if there are many set. If the value is not set,
// an empty string is returned.
//
// The function is binary-key safe.
func (m MD) Get(key string) string {
	k, _ := encodeKeyValue(key, "")
	vv, ok := m[k]
	if !ok {
		return ""
	}
	return vv[0]
}

// Del retrieves a single value from the metadata.
//
// It works analogously to http.Header.Del, deleting all values if they exist.
//
// The function is binary-key safe.

func (m MD) Del(key string) MD {
	k, _ := encodeKeyValue(key, "")
	delete(m, k)
	return m
}

// Set sets the given value in a metadata.
//
// It works analogously to http.Header.Set, overwriting all previous metadata values.
//
// The function is binary-key safe.
func (m MD) Set(key, value string) MD {
	k, v := encodeKeyValue(key, value)
	m[k] = []string{v}
	return m
}

// Add retrieves a single value from the metadata.
//
// It works analogously to http.Header.Add, as it appends to any existing values associated with key.
//
// The function is binary-key safe.
func (m MD) Add(key, value string) MD {
	k, v := encodeKeyValue(key, value)
	m[k] = append(m[k], v)
	return m
}
