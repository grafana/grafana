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

// Package gcsblob provides a blob implementation that uses GCS. Use OpenBucket
// to construct a *blob.Bucket.
//
// # URLs
//
// For blob.OpenBucket, gcsblob registers for the scheme "gs".
// The default URL opener will set up a connection using default credentials
// from the environment, as described in
// https://cloud.google.com/docs/authentication/production.
// You may force the use of an unauthenticated client by setting
// GoogleAccessID to "-" (via Options or via the URL parameter "access_id").
// Some environments, such as GCE, come without a private key. In such cases
// the IAM Credentials API will be configured for use in Options.MakeSignBytes,
// which will introduce latency to any and all calls to bucket.SignedURL
// that you can avoid by installing a service account credentials file or
// obtaining and configuring a private key:
// https://cloud.google.com/iam/docs/creating-managing-service-account-keys
//
// To customize the URL opener, or for more details on the URL format,
// see URLOpener.
// See https://gocloud.dev/concepts/urls/ for background information.
//
// # Escaping
//
// Go CDK supports all UTF-8 strings; to make this work with services lacking
// full UTF-8 support, strings must be escaped (during writes) and unescaped
// (during reads). The following escapes are performed for gcsblob:
//   - Blob keys: ASCII characters 10 and 13 are escaped to "__0x<hex>__".
//     Additionally, the "/" in "../" is escaped in the same way.
//
// # As
//
// gcsblob exposes the following types for As:
//   - Bucket: *storage.Client
//   - Error: *googleapi.Error
//   - ListObject: storage.ObjectAttrs
//   - ListOptions.BeforeList: *storage.Query
//   - Reader: *storage.Reader
//   - ReaderOptions.BeforeRead: **storage.ObjectHandle, *storage.Reader (if accessing both, must be in that order)
//   - Attributes: storage.ObjectAttrs
//   - CopyOptions.BeforeCopy: *CopyObjectHandles, *storage.Copier (if accessing both, must be in that order)
//   - WriterOptions.BeforeWrite: **storage.ObjectHandle, *storage.Writer (if accessing both, must be in that order)
//   - SignedURLOptions.BeforeSign: *storage.SignedURLOptions
package gcsblob // import "gocloud.dev/blob/gcsblob"

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"cloud.google.com/go/compute/metadata"
	"cloud.google.com/go/storage"
	"github.com/google/wire"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"

	"gocloud.dev/blob"
	"gocloud.dev/blob/driver"
	"gocloud.dev/gcerrors"
	"gocloud.dev/gcp"
	"gocloud.dev/internal/escape"
	"gocloud.dev/internal/gcerr"
	"gocloud.dev/internal/useragent"
)

const defaultPageSize = 1000

func init() {
	blob.DefaultURLMux().RegisterBucket(Scheme, new(lazyCredsOpener))
}

// Set holds Wire providers for this package.
var Set = wire.NewSet(
	wire.Struct(new(URLOpener), "Client"),
)

// readDefaultCredentials gets the field values from the supplied JSON data.
// For its possible formats please see
// https://cloud.google.com/iam/docs/creating-managing-service-account-keys#iam-service-account-keys-create-go
//
// Use "golang.org/x/oauth2/google".DefaultCredentials.JSON to get
// the contents of the preferred credential file.
//
// Returns null-values for fields that have not been obtained.
func readDefaultCredentials(credFileAsJSON []byte) (AccessID string, PrivateKey []byte) {
	// For example, a credentials file as generated for service accounts through the web console.
	var contentVariantA struct {
		ClientEmail string `json:"client_email"`
		PrivateKey  string `json:"private_key"`
	}
	if err := json.Unmarshal(credFileAsJSON, &contentVariantA); err == nil {
		AccessID = contentVariantA.ClientEmail
		PrivateKey = []byte(contentVariantA.PrivateKey)
	}
	if AccessID != "" {
		return
	}

	// If obtained through the REST API.
	var contentVariantB struct {
		Name           string `json:"name"`
		PrivateKeyData string `json:"privateKeyData"`
	}
	if err := json.Unmarshal(credFileAsJSON, &contentVariantB); err == nil {
		nextFieldIsAccessID := false
		for _, s := range strings.Split(contentVariantB.Name, "/") {
			if nextFieldIsAccessID {
				AccessID = s
				break
			}
			nextFieldIsAccessID = s == "serviceAccounts"
		}
		PrivateKey = []byte(contentVariantB.PrivateKeyData)
	}

	return
}

// lazyCredsOpener obtains Application Default Credentials on the first call
// to OpenBucketURL.
type lazyCredsOpener struct {
	init   sync.Once
	opener *URLOpener
	err    error
}

func (o *lazyCredsOpener) OpenBucketURL(ctx context.Context, u *url.URL) (*blob.Bucket, error) {
	o.init.Do(func() {
		var opts Options
		var creds *google.Credentials
		if os.Getenv("STORAGE_EMULATOR_HOST") != "" {
			creds, _ = google.CredentialsFromJSON(ctx, []byte(`{"type": "service_account", "project_id": "my-project-id"}`))
		} else {
			var err error
			creds, err = gcp.DefaultCredentials(ctx)
			if err != nil {
				fmt.Printf("Warning: unable to load GCP Default Credentials: %v", err)
				// Use empty credentials, in case the user isn't going to actually use
				// them; e.g., getting signed URLs with GoogleAccessID=-.
				creds, _ = google.CredentialsFromJSON(ctx, []byte(`{"type": "service_account"}`))
			}

			// Populate default values from credentials files, where available.
			opts.GoogleAccessID, opts.PrivateKey = readDefaultCredentials(creds.JSON)

			// ... else, on GCE, at least get the instance's main service account.
			if opts.GoogleAccessID == "" && metadata.OnGCE() {
				mc := metadata.NewClient(nil)
				opts.GoogleAccessID, _ = mc.Email("")
			}
		}

		// Provide a default factory for SignBytes for environments without a private key.
		if len(opts.PrivateKey) <= 0 && opts.GoogleAccessID != "" {
			iam := new(credentialsClient)
			// We cannot hold onto the first context: it might've been cancelled already.
			ctx := context.Background()
			opts.MakeSignBytes = iam.CreateMakeSignBytesWith(ctx, opts.GoogleAccessID)
		}

		client, err := gcp.NewHTTPClient(gcp.DefaultTransport(), creds.TokenSource)
		if err != nil {
			o.err = err
			return
		}
		o.opener = &URLOpener{Client: client, Options: opts}
	})
	if o.err != nil {
		return nil, fmt.Errorf("open bucket %v: %v", u, o.err)
	}
	return o.opener.OpenBucketURL(ctx, u)
}

// Scheme is the URL scheme gcsblob registers its URLOpener under on
// blob.DefaultMux.
const Scheme = "gs"

// URLOpener opens GCS URLs like "gs://mybucket".
//
// The URL host is used as the bucket name.
//
// The following query parameters are supported:
//
//   - anonymous: A value of "true" forces the use of an unauthenticated client.
//   - access_id: Sets Options.GoogleAccessID; only used in SignedURL, except that
//     a value of "-" forces the use of an unauthenticated client.
//   - private_key_path: Path to read for Options.PrivateKey; only used in SignedURL.
type URLOpener struct {
	// Client must be set to a non-nil HTTP client authenticated with
	// Cloud Storage scope or equivalent (unless anonymous=true).
	Client *gcp.HTTPClient

	// Options specifies the default options to pass to OpenBucket.
	Options Options
}

// OpenBucketURL opens the GCS bucket with the same name as the URL's host.
func (o *URLOpener) OpenBucketURL(ctx context.Context, u *url.URL) (*blob.Bucket, error) {
	opts, client, err := o.forParams(ctx, u.Query())
	if err != nil {
		return nil, fmt.Errorf("open bucket %v: %v", u, err)
	}
	return OpenBucket(ctx, client, u.Host, opts)
}

func (o *URLOpener) forParams(ctx context.Context, q url.Values) (*Options, *gcp.HTTPClient, error) {
	for k := range q {
		if k != "access_id" && k != "private_key_path" && k != "anonymous" {
			return nil, nil, fmt.Errorf("invalid query parameter %q", k)
		}
	}
	opts := new(Options)
	*opts = o.Options
	client := o.Client
	if anon := q.Get("anonymous"); anon != "" {
		isAnon, err := strconv.ParseBool(anon)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid value %q for query parameter \"anonymous\": %w", anon, err)
		}
		if isAnon {
			opts.clear()
			client = gcp.NewAnonymousHTTPClient(gcp.DefaultTransport())
		}
	}
	if accessID := q.Get("access_id"); accessID != "" && accessID != opts.GoogleAccessID {
		opts.clear()
		if accessID == "-" {
			client = gcp.NewAnonymousHTTPClient(gcp.DefaultTransport())
		} else {
			opts.GoogleAccessID = accessID
		}
	}
	if keyPath := q.Get("private_key_path"); keyPath != "" {
		pk, err := os.ReadFile(keyPath)
		if err != nil {
			return nil, nil, err
		}
		opts.PrivateKey = pk
	} else if _, exists := q["private_key_path"]; exists {
		// A possible default value has been cleared by setting this to an empty value:
		// The private key might have expired, or falling back to SignBytes/MakeSignBytes
		// is intentional such as for tests or involving a key stored in a HSM/TPM.
		opts.PrivateKey = nil
	}
	return opts, client, nil
}

// Options sets options for constructing a *blob.Bucket backed by GCS.
type Options struct {
	// GoogleAccessID represents the authorizer for SignedURL.
	// If set to "-", an unauthenticated client will be used.
	// Required to use SignedURL.
	// See https://godoc.org/cloud.google.com/go/storage#SignedURLOptions.
	GoogleAccessID string

	// PrivateKey is the Google service account private key.
	// Exactly one of PrivateKey or SignBytes must be non-nil to use SignedURL.
	// See https://godoc.org/cloud.google.com/go/storage#SignedURLOptions.
	// Deprecated: Use MakeSignBytes instead.
	PrivateKey []byte

	// SignBytes is a function for implementing custom signing.
	// Exactly one of PrivateKey, SignBytes, or MakeSignBytes must be non-nil to use SignedURL.
	// See https://godoc.org/cloud.google.com/go/storage#SignedURLOptions.
	// Deprecated: Use MakeSignBytes instead.
	SignBytes func([]byte) ([]byte, error)

	// MakeSignBytes is a factory for functions that are being used in place of an empty SignBytes.
	// If your implementation of 'SignBytes' needs a request context, set this instead.
	MakeSignBytes func(requestCtx context.Context) SignBytesFunc

	// ClientOptions are passed when constructing the storage.Client.
	ClientOptions []option.ClientOption
}

// clear clears all the fields of o.
func (o *Options) clear() {
	o.GoogleAccessID = ""
	o.PrivateKey = nil
	o.SignBytes = nil
	o.MakeSignBytes = nil
}

// SignBytesFunc is shorthand for the signature of Options.SignBytes.
type SignBytesFunc func([]byte) ([]byte, error)

// openBucket returns a GCS Bucket that communicates using the given HTTP client.
func openBucket(ctx context.Context, client *gcp.HTTPClient, bucketName string, opts *Options) (*bucket, error) {
	if client == nil {
		return nil, errors.New("gcsblob.OpenBucket: client is required")
	}
	if bucketName == "" {
		return nil, errors.New("gcsblob.OpenBucket: bucketName is required")
	}

	// We wrap the provided http.Client to add a Go CDK User-Agent.
	clientOpts := []option.ClientOption{option.WithHTTPClient(useragent.HTTPClient(&client.Client, "blob"))}
	if host := os.Getenv("STORAGE_EMULATOR_HOST"); host != "" {
		clientOpts = []option.ClientOption{
			option.WithoutAuthentication(),
			option.WithEndpoint("http://" + host + "/storage/v1/"),
			option.WithHTTPClient(http.DefaultClient),
		}
	}
	if opts == nil {
		opts = &Options{}
	}
	clientOpts = append(clientOpts, opts.ClientOptions...)
	c, err := storage.NewClient(ctx, clientOpts...)
	if err != nil {
		return nil, err
	}
	return &bucket{name: bucketName, client: c, opts: opts}, nil
}

// OpenBucket returns a *blob.Bucket backed by an existing GCS bucket. See the
// package documentation for an example.
func OpenBucket(ctx context.Context, client *gcp.HTTPClient, bucketName string, opts *Options) (*blob.Bucket, error) {
	drv, err := openBucket(ctx, client, bucketName, opts)
	if err != nil {
		return nil, err
	}
	return blob.NewBucket(drv), nil
}

// bucket represents a GCS bucket, which handles read, write and delete operations
// on objects within it.
type bucket struct {
	name   string
	client *storage.Client
	opts   *Options
}

var emptyBody = io.NopCloser(strings.NewReader(""))

// reader reads a GCS object. It implements driver.Reader.
type reader struct {
	body  io.ReadCloser
	attrs driver.ReaderAttributes
	raw   *storage.Reader
}

func (r *reader) Read(p []byte) (int, error) {
	return r.body.Read(p)
}

// Close closes the reader itself. It must be called when done reading.
func (r *reader) Close() error {
	return r.body.Close()
}

func (r *reader) Attributes() *driver.ReaderAttributes {
	return &r.attrs
}

func (r *reader) As(i any) bool {
	p, ok := i.(**storage.Reader)
	if !ok {
		return false
	}
	*p = r.raw
	return true
}

func (b *bucket) ErrorCode(err error) gcerrors.ErrorCode {
	if errors.Is(err, storage.ErrObjectNotExist) || errors.Is(err, storage.ErrBucketNotExist) {
		return gcerrors.NotFound
	}
	if gerr, ok := err.(*googleapi.Error); ok {
		switch gerr.Code {
		case http.StatusForbidden:
			// 'Permission 'storage.objects.list' denied on resource (or it may not exist)'
			// So we have to pick one.
			return gcerrors.NotFound
		case http.StatusNotFound:
			return gcerrors.NotFound
		case http.StatusPreconditionFailed:
			return gcerrors.FailedPrecondition
		case http.StatusTooManyRequests:
			return gcerrors.ResourceExhausted
		}
	}
	return gcerrors.Unknown
}

func (b *bucket) Close() error {
	return nil
}

// ListPaged implements driver.ListPaged.
func (b *bucket) ListPaged(ctx context.Context, opts *driver.ListOptions) (*driver.ListPage, error) {
	bkt := b.client.Bucket(b.name)
	query := &storage.Query{
		Prefix:    escapeKey(opts.Prefix),
		Delimiter: escapeKey(opts.Delimiter),
	}
	if opts.BeforeList != nil {
		asFunc := func(i any) bool {
			p, ok := i.(**storage.Query)
			if !ok {
				return false
			}
			*p = query
			return true
		}
		if err := opts.BeforeList(asFunc); err != nil {
			return nil, err
		}
	}
	pageSize := opts.PageSize
	if pageSize == 0 {
		pageSize = defaultPageSize
	}
	iter := bkt.Objects(ctx, query)
	pager := iterator.NewPager(iter, pageSize, string(opts.PageToken))
	var objects []*storage.ObjectAttrs
	nextPageToken, err := pager.NextPage(&objects)
	if err != nil {
		return nil, err
	}
	page := driver.ListPage{NextPageToken: []byte(nextPageToken)}
	if len(objects) > 0 {
		page.Objects = make([]*driver.ListObject, len(objects))
		for i, obj := range objects {
			toCopy := obj
			asFunc := func(val any) bool {
				p, ok := val.(*storage.ObjectAttrs)
				if !ok {
					return false
				}
				*p = *toCopy
				return true
			}
			if obj.Prefix == "" {
				// Regular blob.
				page.Objects[i] = &driver.ListObject{
					Key:     unescapeKey(obj.Name),
					ModTime: obj.Updated,
					Size:    obj.Size,
					MD5:     obj.MD5,
					AsFunc:  asFunc,
				}
			} else {
				// "Directory".
				page.Objects[i] = &driver.ListObject{
					Key:    unescapeKey(obj.Prefix),
					IsDir:  true,
					AsFunc: asFunc,
				}
			}
		}
		// GCS always returns "directories" at the end; sort them.
		sort.Slice(page.Objects, func(i, j int) bool {
			return page.Objects[i].Key < page.Objects[j].Key
		})
	}
	return &page, nil
}

// As implements driver.As.
func (b *bucket) As(i any) bool {
	p, ok := i.(**storage.Client)
	if !ok {
		return false
	}
	*p = b.client
	return true
}

// As implements driver.ErrorAs.
func (b *bucket) ErrorAs(err error, i any) bool {
	switch v := err.(type) {
	case *googleapi.Error:
		if p, ok := i.(**googleapi.Error); ok {
			*p = v
			return true
		}
	}
	return false
}

// Attributes implements driver.Attributes.
func (b *bucket) Attributes(ctx context.Context, key string) (*driver.Attributes, error) {
	key = escapeKey(key)
	bkt := b.client.Bucket(b.name)
	obj := bkt.Object(key)
	attrs, err := obj.Attrs(ctx)
	if err != nil {
		return nil, err
	}
	// GCS seems to unquote the ETag; restore them.
	// It should be of the form "xxxx" or W/"xxxx".
	eTag := attrs.Etag
	if !strings.HasPrefix(eTag, "W/\"") && !strings.HasPrefix(eTag, "\"") && !strings.HasSuffix(eTag, "\"") {
		eTag = fmt.Sprintf("%q", eTag)
	}
	return &driver.Attributes{
		CacheControl:       attrs.CacheControl,
		ContentDisposition: attrs.ContentDisposition,
		ContentEncoding:    attrs.ContentEncoding,
		ContentLanguage:    attrs.ContentLanguage,
		ContentType:        attrs.ContentType,
		Metadata:           attrs.Metadata,
		CreateTime:         attrs.Created,
		ModTime:            attrs.Updated,
		Size:               attrs.Size,
		MD5:                attrs.MD5,
		ETag:               eTag,
		AsFunc: func(i any) bool {
			p, ok := i.(*storage.ObjectAttrs)
			if !ok {
				return false
			}
			*p = *attrs
			return true
		},
	}, nil
}

// NewRangeReader implements driver.NewRangeReader.
func (b *bucket) NewRangeReader(ctx context.Context, key string, offset, length int64, opts *driver.ReaderOptions) (driver.Reader, error) {
	key = escapeKey(key)
	bkt := b.client.Bucket(b.name)
	obj := bkt.Object(key)

	// Add an extra level of indirection so that BeforeRead can replace obj
	// if needed. For example, ObjectHandle.If returns a new ObjectHandle.
	// Also, make the Reader lazily in case this replacement happens.
	objp := &obj
	makeReader := func() (*storage.Reader, error) {
		return (*objp).NewRangeReader(ctx, offset, length)
	}

	var r *storage.Reader
	var rerr error
	madeReader := false
	if opts.BeforeRead != nil {
		asFunc := func(i any) bool {
			if p, ok := i.(***storage.ObjectHandle); ok && !madeReader {
				*p = objp
				return true
			}
			if p, ok := i.(**storage.Reader); ok {
				if !madeReader {
					r, rerr = makeReader()
					madeReader = true
					if r == nil {
						return false
					}
				}
				*p = r
				return true
			}
			return false
		}
		if err := opts.BeforeRead(asFunc); err != nil {
			return nil, err
		}
	}
	if !madeReader {
		r, rerr = makeReader()
	}
	if rerr != nil {
		return nil, rerr
	}
	return &reader{
		body: r,
		attrs: driver.ReaderAttributes{
			ContentType: r.Attrs.ContentType,
			ModTime:     r.Attrs.LastModified,
			Size:        r.Attrs.Size,
		},
		raw: r,
	}, nil
}

// escapeKey does all required escaping for UTF-8 strings to work with GCS.
func escapeKey(key string) string {
	return escape.HexEscape(key, func(r []rune, i int) bool {
		switch {
		// GCS doesn't handle these characters (determined via experimentation).
		case r[i] == 10 || r[i] == 13:
			return true
		// For "../", escape the trailing slash.
		case i > 1 && r[i] == '/' && r[i-1] == '.' && r[i-2] == '.':
			return true
		}
		return false
	})
}

// unescapeKey reverses escapeKey.
func unescapeKey(key string) string {
	return escape.HexUnescape(key)
}

// NewTypedWriter implements driver.NewTypedWriter.
func (b *bucket) NewTypedWriter(ctx context.Context, key, contentType string, opts *driver.WriterOptions) (driver.Writer, error) {
	key = escapeKey(key)
	bkt := b.client.Bucket(b.name)
	obj := bkt.Object(key)

	if opts.IfNotExist {
		obj = obj.If(storage.Conditions{DoesNotExist: true})
	}
	// Add an extra level of indirection so that BeforeWrite can replace obj
	// if needed. For example, ObjectHandle.If returns a new ObjectHandle.
	// Also, make the Writer lazily in case this replacement happens.
	objp := &obj
	makeWriter := func() *storage.Writer {
		w := (*objp).NewWriter(ctx)
		w.CacheControl = opts.CacheControl
		w.ContentDisposition = opts.ContentDisposition
		w.ContentEncoding = opts.ContentEncoding
		w.ContentLanguage = opts.ContentLanguage
		w.ContentType = contentType
		w.ChunkSize = bufferSize(opts.BufferSize)
		w.Metadata = opts.Metadata
		w.MD5 = opts.ContentMD5
		w.ForceEmptyContentType = opts.DisableContentTypeDetection
		return w
	}

	var w *storage.Writer
	if opts.BeforeWrite != nil {
		asFunc := func(i any) bool {
			if p, ok := i.(***storage.ObjectHandle); ok && w == nil {
				*p = objp
				return true
			}
			if p, ok := i.(**storage.Writer); ok {
				if w == nil {
					w = makeWriter()
				}
				*p = w
				return true
			}
			return false
		}
		if err := opts.BeforeWrite(asFunc); err != nil {
			return nil, err
		}
	}
	if w == nil {
		w = makeWriter()
	}
	return w, nil
}

// CopyObjectHandles holds the ObjectHandles for the destination and source
// of a Copy. It is used by the BeforeCopy As hook.
type CopyObjectHandles struct {
	Dst, Src *storage.ObjectHandle
}

// Copy implements driver.Copy.
func (b *bucket) Copy(ctx context.Context, dstKey, srcKey string, opts *driver.CopyOptions) error {
	dstKey = escapeKey(dstKey)
	srcKey = escapeKey(srcKey)
	bkt := b.client.Bucket(b.name)

	// Add an extra level of indirection so that BeforeCopy can replace the
	// dst or src ObjectHandles if needed.
	// Also, make the Copier lazily in case this replacement happens.
	handles := CopyObjectHandles{
		Dst: bkt.Object(dstKey),
		Src: bkt.Object(srcKey),
	}
	makeCopier := func() *storage.Copier {
		return handles.Dst.CopierFrom(handles.Src)
	}

	var copier *storage.Copier
	if opts.BeforeCopy != nil {
		asFunc := func(i any) bool {
			if p, ok := i.(**CopyObjectHandles); ok && copier == nil {
				*p = &handles
				return true
			}
			if p, ok := i.(**storage.Copier); ok {
				if copier == nil {
					copier = makeCopier()
				}
				*p = copier
				return true
			}
			return false
		}
		if err := opts.BeforeCopy(asFunc); err != nil {
			return err
		}
	}
	if copier == nil {
		copier = makeCopier()
	}
	_, err := copier.Run(ctx)
	return err
}

// Delete implements driver.Delete.
func (b *bucket) Delete(ctx context.Context, key string) error {
	key = escapeKey(key)
	bkt := b.client.Bucket(b.name)
	obj := bkt.Object(key)
	return obj.Delete(ctx)
}

func (b *bucket) SignedURL(ctx context.Context, key string, dopts *driver.SignedURLOptions) (string, error) {
	numSigners := 0
	if b.opts.PrivateKey != nil {
		numSigners++
	}
	if b.opts.SignBytes != nil {
		numSigners++
	}
	if b.opts.MakeSignBytes != nil {
		numSigners++
	}
	if b.opts.GoogleAccessID == "" || numSigners != 1 {
		return "", gcerr.New(gcerr.Unimplemented, nil, 1, "gcsblob: to use SignedURL, you must call OpenBucket with a valid Options.GoogleAccessID and exactly one of Options.PrivateKey, Options.SignBytes, or Options.MakeSignBytes")
	}

	key = escapeKey(key)
	opts := &storage.SignedURLOptions{
		Expires:        time.Now().Add(dopts.Expiry),
		Method:         dopts.Method,
		ContentType:    dopts.ContentType,
		GoogleAccessID: b.opts.GoogleAccessID,
		PrivateKey:     b.opts.PrivateKey,
		SignBytes:      b.opts.SignBytes,
	}
	if b.opts.MakeSignBytes != nil {
		opts.SignBytes = b.opts.MakeSignBytes(ctx)
	}
	if dopts.BeforeSign != nil {
		asFunc := func(i any) bool {
			v, ok := i.(**storage.SignedURLOptions)
			if ok {
				*v = opts
			}
			return ok
		}
		if err := dopts.BeforeSign(asFunc); err != nil {
			return "", err
		}
	}
	return storage.SignedURL(b.name, key, opts)
}

func bufferSize(size int) int {
	if size == 0 {
		return googleapi.DefaultUploadChunkSize
	} else if size > 0 {
		return size
	}
	return 0 // disable buffering
}
