// Copyright 2018 The Go Cloud Development Kit Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package driver defines interfaces to be implemented by blob drivers, which
// will be used by the blob package to interact with the underlying services.
// Application code should use package blob.
package driver // import "gocloud.dev/blob/driver"

import (
	"context"
	"errors"
	"io"
	"strings"
	"time"

	"gocloud.dev/gcerrors"
)

// ReaderOptions controls Reader behaviors.
type ReaderOptions struct {
	// BeforeRead is a callback that must be called exactly once before
	// any data is read, unless NewRangeReader returns an error before then, in
	// which case it should not be called at all.
	// asFunc allows drivers to expose driver-specific types;
	// see Bucket.As for more details.
	BeforeRead func(asFunc func(any) bool) error
}

// Reader reads an object from the blob.
type Reader interface {
	io.ReadCloser

	// Attributes returns a subset of attributes about the blob.
	// The portable type will not modify the returned ReaderAttributes.
	Attributes() *ReaderAttributes

	// As allows drivers to expose driver-specific types;
	// see Bucket.As for more details.
	As(any) bool
}

// Downloader has an optional extra method for readers.
// It is similar to io.WriteTo, but without the count of bytes returned.
type Downloader interface {
	// Download is similar to io.WriteTo, but without the count of bytes returned.
	Download(w io.Writer) error
}

// Writer writes an object to the blob.
type Writer interface {
	io.WriteCloser
}

// Uploader has an optional extra method for writers.
type Uploader interface {
	// Upload is similar to io.ReadFrom, but without the count of bytes returned.
	Upload(r io.Reader) error
}

// WriterOptions controls behaviors of Writer.
type WriterOptions struct {
	// BufferSize changes the default size in byte of the maximum part Writer can
	// write in a single request, if supported. Larger objects will be split into
	// multiple requests.
	BufferSize int
	// MaxConcurrency changes the default concurrency for uploading parts.
	MaxConcurrency int
	// CacheControl specifies caching attributes that services may use
	// when serving the blob.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
	CacheControl string
	// ContentDisposition specifies whether the blob content is expected to be
	// displayed inline or as an attachment.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
	ContentDisposition string
	// ContentEncoding specifies the encoding used for the blob's content, if any.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding
	ContentEncoding string
	// ContentLanguage specifies the language used in the blob's content, if any.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Language
	ContentLanguage string
	// ContentMD5 is used as a message integrity check.
	// The portable type checks that the MD5 hash of the bytes written matches
	// ContentMD5.
	// If len(ContentMD5) > 0, driver implementations may pass it to their
	// underlying network service to guarantee the integrity of the bytes in
	// transit.
	ContentMD5 []byte
	// Metadata holds key/value strings to be associated with the blob.
	// Keys are guaranteed to be non-empty and lowercased.
	Metadata map[string]string
	// When true, the driver should attempt to disable any automatic
	// content-type detection that the provider applies on writes with an
	// empty ContentType.
	DisableContentTypeDetection bool
	// BeforeWrite is a callback that must be called exactly once before
	// any data is written, unless NewTypedWriter returns an error, in
	// which case it should not be called.
	// asFunc allows drivers to expose driver-specific types;
	// see Bucket.As for more details.
	BeforeWrite func(asFunc func(any) bool) error

	// IfNotExist is used for conditional writes.
	// When set to true, if a blob exists for the same key in the bucket, the write operation
	// won't take place.
	IfNotExist bool
}

// CopyOptions controls options for Copy.
type CopyOptions struct {
	// BeforeCopy is a callback that must be called before initiating the Copy.
	// asFunc allows drivers to expose driver-specific types;
	// see Bucket.As for more details.
	BeforeCopy func(asFunc func(any) bool) error
}

// ReaderAttributes contains a subset of attributes about a blob that are
// accessible from Reader.
type ReaderAttributes struct {
	// ContentType is the MIME type of the blob object. It must not be empty.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
	ContentType string
	// ModTime is the time the blob object was last modified.
	ModTime time.Time
	// Size is the size of the object in bytes.
	Size int64
}

// Attributes contains attributes about a blob.
type Attributes struct {
	// CacheControl specifies caching attributes that services may use
	// when serving the blob.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
	CacheControl string
	// ContentDisposition specifies whether the blob content is expected to be
	// displayed inline or as an attachment.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
	ContentDisposition string
	// ContentEncoding specifies the encoding used for the blob's content, if any.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding
	ContentEncoding string
	// ContentLanguage specifies the language used in the blob's content, if any.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Language
	ContentLanguage string
	// ContentType is the MIME type of the blob object. It must not be empty.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
	ContentType string
	// Metadata holds key/value pairs associated with the blob.
	// Keys will be lowercased by the portable type before being returned
	// to the user. If there are duplicate case-insensitive keys (e.g.,
	// "foo" and "FOO"), only one value will be kept, and it is undefined
	// which one.
	Metadata map[string]string
	// CreateTime is the time the blob object was created. If not available,
	// leave as the zero time.
	CreateTime time.Time
	// ModTime is the time the blob object was last modified.
	ModTime time.Time
	// Size is the size of the object in bytes.
	Size int64
	// MD5 is an MD5 hash of the blob contents or nil if not available.
	MD5 []byte
	// ETag for the blob; see https://en.wikipedia.org/wiki/HTTP_ETag.
	ETag string
	// AsFunc allows drivers to expose driver-specific types;
	// see Bucket.As for more details.
	// If not set, no driver-specific types are supported.
	AsFunc func(any) bool
}

// ListOptions sets options for listing objects in the bucket.
type ListOptions struct {
	// Prefix indicates that only results with the given prefix should be
	// returned.
	Prefix string
	// Delimiter sets the delimiter used to define a hierarchical namespace,
	// like a filesystem with "directories".
	//
	// An empty delimiter means that the bucket is treated as a single flat
	// namespace.
	//
	// A non-empty delimiter means that any result with the delimiter in its key
	// after Prefix is stripped will be returned with ListObject.IsDir = true,
	// ListObject.Key truncated after the delimiter, and zero values for other
	// ListObject fields. These results represent "directories". Multiple results
	// in a "directory" are returned as a single result.
	Delimiter string
	// PageSize sets the maximum number of objects to be returned.
	// 0 means no maximum; driver implementations should choose a reasonable
	// max. It is guaranteed to be >= 0.
	PageSize int
	// PageToken may be filled in with the NextPageToken from a previous
	// ListPaged call.
	PageToken []byte
	// BeforeList is a callback that must be called exactly once during ListPaged,
	// before the underlying service's list is executed.
	// asFunc allows drivers to expose driver-specific types;
	// see Bucket.As for more details.
	BeforeList func(asFunc func(any) bool) error
}

// ListObject represents a specific blob object returned from ListPaged.
type ListObject struct {
	// Key is the key for this blob.
	Key string
	// ModTime is the time the blob object was last modified.
	ModTime time.Time
	// Size is the size of the object in bytes.
	Size int64
	// MD5 is an MD5 hash of the blob contents or nil if not available.
	MD5 []byte
	// IsDir indicates that this result represents a "directory" in the
	// hierarchical namespace, ending in ListOptions.Delimiter. Key can be
	// passed as ListOptions.Prefix to list items in the "directory".
	// Fields other than Key and IsDir will not be set if IsDir is true.
	IsDir bool
	// AsFunc allows drivers to expose driver-specific types;
	// see Bucket.As for more details.
	// If not set, no driver-specific types are supported.
	AsFunc func(any) bool
}

// ListPage represents a page of results return from ListPaged.
type ListPage struct {
	// Objects is the slice of objects found. If ListOptions.PageSize > 0,
	// it should have at most ListOptions.PageSize entries.
	//
	// Objects should be returned in lexicographical order of UTF-8 encoded keys,
	// including across pages. I.e., all objects returned from a ListPage request
	// made using a PageToken from a previous ListPage request's NextPageToken
	// should have Key >= the Key for all objects from the previous request.
	Objects []*ListObject
	// NextPageToken should be left empty unless there are more objects
	// to return. The value may be returned as ListOptions.PageToken on a
	// subsequent ListPaged call, to fetch the next page of results.
	// It can be an arbitrary []byte; it need not be a valid key.
	NextPageToken []byte
}

// Bucket provides read, write and delete operations on objects within it on the
// blob service.
type Bucket interface {
	// ErrorCode should return a code that describes the error, which was returned by
	// one of the other methods in this interface.
	ErrorCode(error) gcerrors.ErrorCode

	// As converts i to driver-specific types.
	// See https://gocloud.dev/concepts/as/ for background information.
	As(i any) bool

	// ErrorAs allows drivers to expose driver-specific types for returned
	// errors.
	// See https://gocloud.dev/concepts/as/ for background information.
	ErrorAs(error, any) bool

	// Attributes returns attributes for the blob. If the specified object does
	// not exist, Attributes must return an error for which ErrorCode returns
	// gcerrors.NotFound.
	// The portable type will not modify the returned Attributes.
	Attributes(ctx context.Context, key string) (*Attributes, error)

	// ListPaged lists objects in the bucket, in lexicographical order by
	// UTF-8-encoded key, returning pages of objects at a time.
	// Services are only required to be eventually consistent with respect
	// to recently written or deleted objects. That is to say, there is no
	// guarantee that an object that's been written will immediately be returned
	// from ListPaged.
	// opts is guaranteed to be non-nil.
	ListPaged(ctx context.Context, opts *ListOptions) (*ListPage, error)

	// NewRangeReader returns a Reader that reads part of an object, reading at
	// most length bytes starting at the given offset. If length is negative, it
	// will read until the end of the object. If the specified object does not
	// exist, NewRangeReader must return an error for which ErrorCode returns
	// gcerrors.NotFound.
	// opts is guaranteed to be non-nil.
	//
	// The returned Reader *may* also implement Downloader if the underlying
	// implementation can take advantage of that. The Download call is guaranteed
	// to be the only call to the Reader. For such readers, offset will always
	// be 0 and length will always be -1.
	NewRangeReader(ctx context.Context, key string, offset, length int64, opts *ReaderOptions) (Reader, error)

	// NewTypedWriter returns Writer that writes to an object associated with key.
	//
	// A new object will be created unless an object with this key already exists.
	// Otherwise any previous object with the same key will be replaced.
	// The object may not be available (and any previous object will remain)
	// until Close has been called.
	//
	// contentType sets the MIME type of the object to be written.
	// opts is guaranteed to be non-nil.
	//
	// The caller must call Close on the returned Writer when done writing.
	//
	// Implementations should abort an ongoing write if ctx is later canceled,
	// and do any necessary cleanup in Close. Close should then return ctx.Err().
	//
	// The returned Writer *may* also implement Uploader if the underlying
	// implementation can take advantage of that. The Upload call is guaranteed
	// to be the only non-Close call to the Writer..
	NewTypedWriter(ctx context.Context, key, contentType string, opts *WriterOptions) (Writer, error)

	// Copy copies the object associated with srcKey to dstKey.
	//
	// If the source object does not exist, Copy must return an error for which
	// ErrorCode returns gcerrors.NotFound.
	//
	// If the destination object already exists, it should be overwritten.
	//
	// opts is guaranteed to be non-nil.
	Copy(ctx context.Context, dstKey, srcKey string, opts *CopyOptions) error

	// Delete deletes the object associated with key. If the specified object does
	// not exist, Delete must return an error for which ErrorCode returns
	// gcerrors.NotFound.
	Delete(ctx context.Context, key string) error

	// SignedURL returns a URL that can be used to GET the blob for the duration
	// specified in opts.Expiry. opts is guaranteed to be non-nil.
	// If not supported, return an error for which ErrorCode returns
	// gcerrors.Unimplemented.
	SignedURL(ctx context.Context, key string, opts *SignedURLOptions) (string, error)

	// Close cleans up any resources used by the Bucket. Once Close is called,
	// there will be no method calls to the Bucket other than As, ErrorAs, and
	// ErrorCode. There may be open readers or writers that will receive calls.
	// It is up to the driver as to how these will be handled.
	Close() error
}

// SignedURLOptions sets options for SignedURL.
type SignedURLOptions struct {
	// Expiry sets how long the returned URL is valid for. It is guaranteed to be > 0.
	Expiry time.Duration

	// Method is the HTTP method that can be used on the URL; one of "GET", "PUT",
	// or "DELETE". Drivers must implement all 3.
	Method string

	// ContentType specifies the Content-Type HTTP header the user agent is
	// permitted to use in the PUT request. It must match exactly. See
	// EnforceAbsentContentType for behavior when ContentType is the empty string.
	// If this field is not empty and the bucket cannot enforce the Content-Type
	// header, it must return an Unimplemented error.
	//
	// This field will not be set for any non-PUT requests.
	ContentType string

	// If EnforceAbsentContentType is true and ContentType is the empty string,
	// then PUTing to the signed URL must fail if the Content-Type header is
	// present or the implementation must return an error if it cannot enforce
	// this. If EnforceAbsentContentType is false and ContentType is the empty
	// string, implementations should validate the Content-Type header if possible.
	// If EnforceAbsentContentType is true and the bucket cannot enforce the
	// Content-Type header, it must return an Unimplemented error.
	//
	// This field will always be false for non-PUT requests.
	EnforceAbsentContentType bool

	// BeforeSign is a callback that will be called before each call to the
	// the underlying service's sign functionality.
	// asFunc converts its argument to driver-specific types.
	// See https://gocloud.dev/concepts/as/ for background information.
	BeforeSign func(asFunc func(any) bool) error
}

// prefixedBucket implements Bucket by prepending prefix to all keys.
type prefixedBucket struct {
	base   Bucket
	prefix string
}

// NewPrefixedBucket returns a Bucket based on b with all keys modified to have
// prefix.
func NewPrefixedBucket(b Bucket, prefix string) Bucket {
	return &prefixedBucket{base: b, prefix: prefix}
}

func (b *prefixedBucket) ErrorCode(err error) gcerrors.ErrorCode { return b.base.ErrorCode(err) }
func (b *prefixedBucket) As(i any) bool                          { return b.base.As(i) }
func (b *prefixedBucket) ErrorAs(err error, i any) bool          { return b.base.ErrorAs(err, i) }
func (b *prefixedBucket) Attributes(ctx context.Context, key string) (*Attributes, error) {
	return b.base.Attributes(ctx, b.prefix+key)
}

func (b *prefixedBucket) ListPaged(ctx context.Context, opts *ListOptions) (*ListPage, error) {
	var myopts ListOptions
	if opts != nil {
		myopts = *opts
	}
	myopts.Prefix = b.prefix + myopts.Prefix
	page, err := b.base.ListPaged(ctx, &myopts)
	if err != nil {
		return nil, err
	}
	for _, p := range page.Objects {
		p.Key = strings.TrimPrefix(p.Key, b.prefix)
	}
	return page, nil
}

func (b *prefixedBucket) NewRangeReader(ctx context.Context, key string, offset, length int64, opts *ReaderOptions) (Reader, error) {
	return b.base.NewRangeReader(ctx, b.prefix+key, offset, length, opts)
}

func (b *prefixedBucket) NewTypedWriter(ctx context.Context, key, contentType string, opts *WriterOptions) (Writer, error) {
	if key == "" {
		return nil, errors.New("invalid key (empty string)")
	}
	return b.base.NewTypedWriter(ctx, b.prefix+key, contentType, opts)
}

func (b *prefixedBucket) Copy(ctx context.Context, dstKey, srcKey string, opts *CopyOptions) error {
	return b.base.Copy(ctx, b.prefix+dstKey, b.prefix+srcKey, opts)
}

func (b *prefixedBucket) Delete(ctx context.Context, key string) error {
	return b.base.Delete(ctx, b.prefix+key)
}

func (b *prefixedBucket) SignedURL(ctx context.Context, key string, opts *SignedURLOptions) (string, error) {
	return b.base.SignedURL(ctx, b.prefix+key, opts)
}
func (b *prefixedBucket) Close() error { return b.base.Close() }

// singleKeyBucket implements Bucket by hardwiring a specific key.
type singleKeyBucket struct {
	base Bucket
	key  string
}

// NewSingleKeyBucket returns a Bucket based on b that always references key.
func NewSingleKeyBucket(b Bucket, key string) Bucket {
	return &singleKeyBucket{base: b, key: key}
}

func (b *singleKeyBucket) ErrorCode(err error) gcerrors.ErrorCode { return b.base.ErrorCode(err) }
func (b *singleKeyBucket) As(i any) bool                          { return b.base.As(i) }
func (b *singleKeyBucket) ErrorAs(err error, i any) bool          { return b.base.ErrorAs(err, i) }
func (b *singleKeyBucket) Attributes(ctx context.Context, _ string) (*Attributes, error) {
	return b.base.Attributes(ctx, b.key)
}

func (b *singleKeyBucket) ListPaged(ctx context.Context, opts *ListOptions) (*ListPage, error) {
	return nil, errors.New("List not supported for SingleKey buckets")
}

func (b *singleKeyBucket) NewRangeReader(ctx context.Context, _ string, offset, length int64, opts *ReaderOptions) (Reader, error) {
	return b.base.NewRangeReader(ctx, b.key, offset, length, opts)
}

func (b *singleKeyBucket) NewTypedWriter(ctx context.Context, _, contentType string, opts *WriterOptions) (Writer, error) {
	return b.base.NewTypedWriter(ctx, b.key, contentType, opts)
}

func (b *singleKeyBucket) Copy(ctx context.Context, dstKey, _ string, opts *CopyOptions) error {
	return b.base.Copy(ctx, dstKey, b.key, opts)
}

func (b *singleKeyBucket) Delete(ctx context.Context, _ string) error {
	return b.base.Delete(ctx, b.key)
}

func (b *singleKeyBucket) SignedURL(ctx context.Context, _ string, opts *SignedURLOptions) (string, error) {
	return b.base.SignedURL(ctx, b.key, opts)
}
func (b *singleKeyBucket) Close() error { return b.base.Close() }
