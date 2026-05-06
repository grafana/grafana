// Copyright 2016 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package storage

import (
	"context"
	"errors"
	"fmt"

	"cloud.google.com/go/internal/trace"
)

// CopierFrom creates a Copier that can copy src to dst.
// You can immediately call Run on the returned Copier, or
// you can configure it first.
//
// For Requester Pays buckets, the user project of dst is billed, unless it is empty,
// in which case the user project of src is billed.
func (dst *ObjectHandle) CopierFrom(src *ObjectHandle) *Copier {
	return &Copier{dst: dst, src: src}
}

// A Copier copies a source object to a destination.
type Copier struct {
	// ObjectAttrs are optional attributes to set on the destination object.
	// Any attributes must be initialized before any calls on the Copier. Nil
	// or zero-valued attributes are ignored.
	ObjectAttrs

	// RewriteToken can be set before calling Run to resume a copy
	// operation. After Run returns a non-nil error, RewriteToken will
	// have been updated to contain the value needed to resume the copy.
	RewriteToken string

	// ProgressFunc can be used to monitor the progress of a multi-RPC copy
	// operation. If ProgressFunc is not nil and copying requires multiple
	// calls to the underlying service (see
	// https://cloud.google.com/storage/docs/json_api/v1/objects/rewrite), then
	// ProgressFunc will be invoked after each call with the number of bytes of
	// content copied so far and the total size in bytes of the source object.
	//
	// ProgressFunc is intended to make upload progress available to the
	// application. For example, the implementation of ProgressFunc may update
	// a progress bar in the application's UI, or log the result of
	// float64(copiedBytes)/float64(totalBytes).
	//
	// ProgressFunc should return quickly without blocking.
	ProgressFunc func(copiedBytes, totalBytes uint64)

	// The Cloud KMS key, in the form projects/P/locations/L/keyRings/R/cryptoKeys/K,
	// that will be used to encrypt the object. Overrides the object's KMSKeyName, if
	// any.
	//
	// Providing both a DestinationKMSKeyName and a customer-supplied encryption key
	// (via ObjectHandle.Key) on the destination object will result in an error when
	// Run is called.
	DestinationKMSKeyName string

	dst, src *ObjectHandle

	// The maximum number of bytes that will be rewritten per rewrite request.
	// Most callers shouldn't need to specify this parameter - it is primarily
	// in place to support testing. If specified the value must be an integral
	// multiple of 1 MiB (1048576). Also, this only applies to requests where
	// the source and destination span locations and/or storage classes. Finally,
	// this value must not change across rewrite calls else you'll get an error
	// that the `rewriteToken` is invalid.
	maxBytesRewrittenPerCall int64
}

// Run performs the copy.
func (c *Copier) Run(ctx context.Context) (attrs *ObjectAttrs, err error) {
	ctx = trace.StartSpan(ctx, "cloud.google.com/go/storage.Copier.Run")
	defer func() { trace.EndSpan(ctx, err) }()

	if err := c.src.validate(); err != nil {
		return nil, err
	}
	if err := c.dst.validate(); err != nil {
		return nil, err
	}
	if c.DestinationKMSKeyName != "" && c.dst.encryptionKey != nil {
		return nil, errors.New("storage: cannot use DestinationKMSKeyName with a customer-supplied encryption key")
	}
	if c.dst.gen != defaultGen {
		return nil, fmt.Errorf("storage: generation cannot be specified on copy destination, got %v", c.dst.gen)
	}
	// Convert destination attributes to raw form, omitting the bucket.
	// If the bucket is included but name or content-type aren't, the service
	// returns a 400 with "Required" as the only message. Omitting the bucket
	// does not cause any problems.
	req := &rewriteObjectRequest{
		srcObject: sourceObject{
			name:          c.src.object,
			bucket:        c.src.bucket,
			gen:           c.src.gen,
			conds:         c.src.conds,
			encryptionKey: c.src.encryptionKey,
		},
		dstObject: destinationObject{
			name:          c.dst.object,
			bucket:        c.dst.bucket,
			conds:         c.dst.conds,
			attrs:         &c.ObjectAttrs,
			encryptionKey: c.dst.encryptionKey,
			keyName:       c.DestinationKMSKeyName,
		},
		predefinedACL:            c.PredefinedACL,
		token:                    c.RewriteToken,
		maxBytesRewrittenPerCall: c.maxBytesRewrittenPerCall,
	}

	isIdempotent := c.dst.conds != nil && (c.dst.conds.GenerationMatch != 0 || c.dst.conds.DoesNotExist)
	var userProject string
	if c.dst.userProject != "" {
		userProject = c.dst.userProject
	} else if c.src.userProject != "" {
		userProject = c.src.userProject
	}
	opts := makeStorageOpts(isIdempotent, c.dst.retry, userProject)

	for {
		res, err := c.dst.c.tc.RewriteObject(ctx, req, opts...)
		if err != nil {
			return nil, err
		}
		c.RewriteToken = res.token
		req.token = res.token
		if c.ProgressFunc != nil {
			c.ProgressFunc(uint64(res.written), uint64(res.size))
		}
		if res.done { // Finished successfully.
			return res.resource, nil
		}
	}
}

// ComposerFrom creates a Composer that can compose srcs into dst.
// You can immediately call Run on the returned Composer, or you can
// configure it first.
//
// The encryption key for the destination object will be used to decrypt all
// source objects and encrypt the destination object. It is an error
// to specify an encryption key for any of the source objects.
func (dst *ObjectHandle) ComposerFrom(srcs ...*ObjectHandle) *Composer {
	return &Composer{dst: dst, srcs: srcs}
}

// A Composer composes source objects into a destination object.
//
// For Requester Pays buckets, the user project of dst is billed.
type Composer struct {
	// ObjectAttrs are optional attributes to set on the destination object.
	// Any attributes must be initialized before any calls on the Composer. Nil
	// or zero-valued attributes are ignored.
	ObjectAttrs

	// SendCRC specifies whether to transmit a CRC32C field. It should be set
	// to true in addition to setting the Composer's CRC32C field, because zero
	// is a valid CRC and normally a zero would not be transmitted.
	// If a CRC32C is sent, and the data in the destination object does not match
	// the checksum, the compose will be rejected.
	SendCRC32C bool

	dst  *ObjectHandle
	srcs []*ObjectHandle
}

// Run performs the compose operation.
func (c *Composer) Run(ctx context.Context) (attrs *ObjectAttrs, err error) {
	ctx = trace.StartSpan(ctx, "cloud.google.com/go/storage.Composer.Run")
	defer func() { trace.EndSpan(ctx, err) }()

	if err := c.dst.validate(); err != nil {
		return nil, err
	}
	if c.dst.gen != defaultGen {
		return nil, fmt.Errorf("storage: generation cannot be specified on compose destination, got %v", c.dst.gen)
	}
	if len(c.srcs) == 0 {
		return nil, errors.New("storage: at least one source object must be specified")
	}

	for _, src := range c.srcs {
		if err := src.validate(); err != nil {
			return nil, err
		}
		if src.bucket != c.dst.bucket {
			return nil, fmt.Errorf("storage: all source objects must be in bucket %q, found %q", c.dst.bucket, src.bucket)
		}
		if src.encryptionKey != nil {
			return nil, fmt.Errorf("storage: compose source %s.%s must not have encryption key", src.bucket, src.object)
		}
	}

	req := &composeObjectRequest{
		dstBucket:     c.dst.bucket,
		predefinedACL: c.PredefinedACL,
		sendCRC32C:    c.SendCRC32C,
	}
	req.dstObject = destinationObject{
		name:          c.dst.object,
		bucket:        c.dst.bucket,
		conds:         c.dst.conds,
		attrs:         &c.ObjectAttrs,
		encryptionKey: c.dst.encryptionKey,
	}
	for _, src := range c.srcs {
		s := sourceObject{
			name:   src.object,
			bucket: src.bucket,
			gen:    src.gen,
			conds:  src.conds,
		}
		req.srcs = append(req.srcs, s)
	}

	isIdempotent := c.dst.conds != nil && (c.dst.conds.GenerationMatch != 0 || c.dst.conds.DoesNotExist)
	opts := makeStorageOpts(isIdempotent, c.dst.retry, c.dst.userProject)
	return c.dst.c.tc.ComposeObject(ctx, req, opts...)
}
