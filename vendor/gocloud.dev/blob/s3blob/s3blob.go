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

// Package s3blob provides a blob implementation that uses S3. Use OpenBucket
// to construct a *blob.Bucket.
//
// # URLs
//
// For blob.OpenBucket, s3blob registers for the scheme "s3".
// The default URL opener will use an AWS session with the default credentials
// and configuration.
//
// To customize the URL opener, or for more details on the URL format,
// see URLOpener.
// See https://gocloud.dev/concepts/urls/ for background information.
//
// # Escaping
//
// Go CDK supports all UTF-8 strings; to make this work with services lacking
// full UTF-8 support, strings must be escaped (during writes) and unescaped
// (during reads). The following escapes are performed for s3blob:
//   - Blob keys: ASCII characters 0-31 are escaped to "__0x<hex>__".
//     Additionally, the "/" in "../" is escaped in the same way.
//   - Metadata keys: Escaped using URL encoding, then additionally "@:=" are
//     escaped using "__0x<hex>__". These characters were determined by
//     experimentation.
//   - Metadata values: Escaped using URL encoding.
//
// # As
//
// s3blob exposes the following types for As:
//   - Bucket: *s3.Client
//   - Error: any error type returned by the service, notably smithy.APIError
//   - ListObject: types.Object for objects, types.CommonPrefix for "directories"
//   - ListOptions.BeforeList: *s3.ListObjectsV2Input or *[]func(*s3.Options), or *s3.ListObjectsInput
//     when Options.UseLegacyList == true
//   - Reader: s3.GetObjectOutput
//   - ReaderOptions.BeforeRead: *s3.GetObjectInput or *[]func(*s3.Options)
//   - Attributes: s3.HeadObjectOutput
//   - CopyOptions.BeforeCopy: s3.CopyObjectInput
//   - WriterOptions.BeforeWrite: *s3.PutObjectInput, *s3manager.Uploader
//   - SignedURLOptions.BeforeSign: *s3.GetObjectInput, when Options.Method == http.MethodGet, or
//       *s3.PutObjectInput, when Options.Method == http.MethodPut

package s3blob // import "gocloud.dev/blob/s3blob"

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3manager "github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/aws/smithy-go"
	"github.com/google/wire"
	gcaws "gocloud.dev/aws"
	"gocloud.dev/blob"
	"gocloud.dev/blob/driver"
	"gocloud.dev/gcerrors"
	"gocloud.dev/internal/escape"
	"gocloud.dev/internal/gcerr"
)

const defaultPageSize = 1000

func init() {
	blob.DefaultURLMux().RegisterBucket(Scheme, new(urlSessionOpener))
}

// Set holds Wire providers for this package.
var Set = wire.NewSet(
	Dial,
)

// Dial gets an AWS S3 service client using the AWS SDK V2.
func Dial(cfg aws.Config) *s3.Client {
	return s3.NewFromConfig(cfg)
}

type urlSessionOpener struct{}

func (o *urlSessionOpener) OpenBucketURL(ctx context.Context, u *url.URL) (*blob.Bucket, error) {
	opener := &URLOpener{}
	return opener.OpenBucketURL(ctx, u)
}

// Scheme is the URL scheme s3blob registers its URLOpener under on
// blob.DefaultMux.
const Scheme = "s3"

// URLOpener opens S3 URLs like "s3://mybucket".
//
// The URL host is used as the bucket name.
//
// See https://pkg.go.dev/gocloud.dev/aws#V2ConfigFromURLParams.
//
// The following S3-specific query options are also supported:
//   - ssetype: The type of server side encryption used (AES256, aws:kms, aws:kms:dsse)
//   - kmskeyid: The KMS key ID for server side encryption
//   - accelerate: A value of "true" uses the S3 Transfer Accleration endpoints
//   - use_path_style: A value of true sets the UsePathStyle option.
//   - s3ForcePathStyle: Same as use_path_style, for backwards compatibility with V1.
//   - disable_https: A value of true disables HTTPS in the Endpoint options.
type URLOpener struct {
	// Options specifies the options to pass to OpenBucket.
	Options Options
}

const (
	sseTypeParamKey            = "ssetype"
	kmsKeyIdParamKey           = "kmskeyid"
	accelerateParamKey         = "accelerate"
	usePathStyleParamKey       = "use_path_style"
	legacyUsePathStyleParamKey = "s3ForcePathStyle" // for backwards compatibility
	disableHTTPSParamKey       = "disable_https"
)

func toServerSideEncryptionType(value string) (types.ServerSideEncryption, error) {
	for _, sseType := range types.ServerSideEncryptionAes256.Values() {
		if strings.EqualFold(string(sseType), value) {
			return sseType, nil
		}
	}
	return "", fmt.Errorf("%q is not a valid value for %q", value, sseTypeParamKey)
}

// OpenBucketURL opens a blob.Bucket based on u.
func (o *URLOpener) OpenBucketURL(ctx context.Context, u *url.URL) (*blob.Bucket, error) {
	q := u.Query()

	if sseTypeParam := q.Get(sseTypeParamKey); sseTypeParam != "" {
		q.Del(sseTypeParamKey)

		sseType, err := toServerSideEncryptionType(sseTypeParam)
		if err != nil {
			return nil, err
		}

		o.Options.EncryptionType = sseType
	}

	if kmsKeyID := q.Get(kmsKeyIdParamKey); kmsKeyID != "" {
		q.Del(kmsKeyIdParamKey)
		o.Options.KMSEncryptionID = kmsKeyID
	}

	accelerate := false
	if accelerateParam := q.Get(accelerateParamKey); accelerateParam != "" {
		q.Del(accelerateParamKey)
		var err error
		accelerate, err = strconv.ParseBool(accelerateParam)
		if err != nil {
			return nil, fmt.Errorf("invalid value for %q: %v", accelerateParamKey, err)
		}
	}

	opts := []func(*s3.Options){
		func(o *s3.Options) {
			o.UseAccelerate = accelerate
		},
	}
	if disableHTTPSParam := q.Get(disableHTTPSParamKey); disableHTTPSParam != "" {
		q.Del(disableHTTPSParamKey)
		value, err := strconv.ParseBool(disableHTTPSParam)
		if err != nil {
			return nil, fmt.Errorf("invalid value for %q: %v", disableHTTPSParamKey, err)
		}
		opts = append(opts, func(o *s3.Options) {
			o.EndpointOptions.DisableHTTPS = value
		})
	}
	for _, key := range []string{usePathStyleParamKey, legacyUsePathStyleParamKey} {
		if usePathStyleParam := q.Get(key); usePathStyleParam != "" {
			q.Del(key)
			value, err := strconv.ParseBool(usePathStyleParam)
			if err != nil {
				return nil, fmt.Errorf("invalid value for %q: %v", key, err)
			}
			opts = append(opts, func(o *s3.Options) {
				o.UsePathStyle = value
			})
		}
	}

	cfg, err := gcaws.V2ConfigFromURLParams(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("open bucket %v: %v", u, err)
	}
	client := s3.NewFromConfig(cfg, opts...)

	return OpenBucket(ctx, client, u.Host, &o.Options)
}

// Options sets options for constructing a *blob.Bucket backed by fileblob.
type Options struct {
	// UseLegacyList forces the use of ListObjects instead of ListObjectsV2.
	// Some S3-compatible services (like CEPH) do not currently support
	// ListObjectsV2.
	UseLegacyList bool

	// EncryptionType sets the encryption type headers when making write or
	// copy calls. This is required if the bucket has a restrictive bucket
	// policy that enforces a specific encryption type
	EncryptionType types.ServerSideEncryption

	// KMSEncryptionID sets the kms key id header for write or copy calls.
	// This is required when a bucket policy enforces the use of a specific
	// KMS key for uploads
	KMSEncryptionID string
}

// openBucket returns an S3 Bucket.
func openBucket(ctx context.Context, client *s3.Client, bucketName string, opts *Options) (*bucket, error) {
	if bucketName == "" {
		return nil, errors.New("s3blob.OpenBucket: bucketName is required")
	}
	if opts == nil {
		opts = &Options{}
	}
	if client == nil {
		return nil, errors.New("s3blob.OpenBucket: client is required")
	}
	return &bucket{
		name:           bucketName,
		client:         client,
		useLegacyList:  opts.UseLegacyList,
		kmsKeyId:       opts.KMSEncryptionID,
		encryptionType: opts.EncryptionType,
	}, nil
}

// OpenBucket returns a *blob.Bucket backed by S3, using AWS SDK v2.
func OpenBucket(ctx context.Context, client *s3.Client, bucketName string, opts *Options) (*blob.Bucket, error) {
	drv, err := openBucket(ctx, client, bucketName, opts)
	if err != nil {
		return nil, err
	}
	return blob.NewBucket(drv), nil
}

var OpenBucketV2 = OpenBucket

// reader reads an S3 object. It implements io.ReadCloser.
type reader struct {
	body  io.ReadCloser
	attrs driver.ReaderAttributes
	raw   *s3.GetObjectOutput
}

func (r *reader) Read(p []byte) (int, error) {
	return r.body.Read(p)
}

// Close closes the reader itself. It must be called when done reading.
func (r *reader) Close() error {
	return r.body.Close()
}

func (r *reader) As(i any) bool {
	p, ok := i.(*s3.GetObjectOutput)
	if !ok {
		return false
	}
	*p = *r.raw
	return true
}

func (r *reader) Attributes() *driver.ReaderAttributes {
	return &r.attrs
}

// writer writes an S3 object, it implements io.WriteCloser.
type writer struct {
	// Ends of an io.Pipe, created when the first byte is written.
	pw *io.PipeWriter
	pr *io.PipeReader

	// Alternatively, upload is set to true when Upload was
	// used to upload data.
	upload bool

	ctx      context.Context
	uploader *s3manager.Uploader
	req      *s3.PutObjectInput

	donec chan struct{} // closed when done writing
	// The following fields will be written before donec closes:
	err error
}

// Write appends p to w.pw. User must call Close to close the w after done writing.
func (w *writer) Write(p []byte) (int, error) {
	// Avoid opening the pipe for a zero-length write;
	// the concrete can do these for empty blobs.
	if len(p) == 0 {
		return 0, nil
	}
	if w.pw == nil {
		// We'll write into pw and use pr as an io.Reader for the
		// Upload call to S3.
		w.pr, w.pw = io.Pipe()
		w.open(w.pr, true)
	}
	return w.pw.Write(p)
}

// Upload reads from r. Per the driver, it is guaranteed to be the only
// write call for this writer.
func (w *writer) Upload(r io.Reader) error {
	w.upload = true
	w.open(r, false)
	return nil
}

// r may be nil if we're Closing and no data was written.
// If closePipeOnError is true, w.pr will be closed if there's an
// error uploading to S3.
func (w *writer) open(r io.Reader, closePipeOnError bool) {
	// This goroutine will keep running until Close, unless there's an error.
	go func() {
		defer close(w.donec)

		if r == nil {
			// AWS doesn't like a nil Body.
			r = http.NoBody
		}
		var err error
		w.req.Body = r
		_, err = w.uploader.Upload(w.ctx, w.req)
		if err != nil {
			if closePipeOnError {
				w.pr.CloseWithError(err)
			}
			w.err = err
		}
	}()
}

// Close completes the writer and closes it. Any error occurring during write
// will be returned. If a writer is closed before any Write is called, Close
// will create an empty file at the given key.
func (w *writer) Close() error {
	if !w.upload {
		if w.pr != nil {
			defer w.pr.Close()
		}
		if w.pw == nil {
			// We never got any bytes written. We'll write an http.NoBody.
			w.open(nil, false)
		} else if err := w.pw.Close(); err != nil {
			return err
		}
	}
	<-w.donec
	return w.err
}

// bucket represents an S3 bucket and handles read, write and delete operations.
type bucket struct {
	name          string
	client        *s3.Client
	useLegacyList bool

	encryptionType types.ServerSideEncryption
	kmsKeyId       string
}

func (b *bucket) Close() error {
	return nil
}

func (b *bucket) ErrorCode(err error) gcerrors.ErrorCode {
	var code string
	var ae smithy.APIError
	var oe *smithy.OperationError
	if errors.As(err, &oe) && strings.Contains(oe.Error(), "301") {
		// AWS returns an OperationError with a missing redirect for invalid buckets.
		code = "NoSuchBucket"
	} else if errors.As(err, &ae) {
		code = ae.ErrorCode()
	} else {
		return gcerrors.Unknown
	}
	switch {
	case code == "NoSuchBucket" || code == "NoSuchKey" || code == "NotFound" || code == "ObjectNotInActiveTierError":
		return gcerrors.NotFound
	case code == "PreconditionFailed":
		return gcerrors.FailedPrecondition
	default:
		return gcerrors.Unknown
	}
}

// ListPaged implements driver.ListPaged.
func (b *bucket) ListPaged(ctx context.Context, opts *driver.ListOptions) (*driver.ListPage, error) {
	pageSize := opts.PageSize
	if pageSize == 0 {
		pageSize = defaultPageSize
	}
	in := &s3.ListObjectsV2Input{
		Bucket:  aws.String(b.name),
		MaxKeys: aws.Int32(int32(pageSize)),
	}
	if len(opts.PageToken) > 0 {
		in.ContinuationToken = aws.String(string(opts.PageToken))
	}
	if opts.Prefix != "" {
		in.Prefix = aws.String(escapeKey(opts.Prefix))
	}
	if opts.Delimiter != "" {
		in.Delimiter = aws.String(escapeKey(opts.Delimiter))
	}
	resp, err := b.listObjects(ctx, in, opts)
	if err != nil {
		return nil, err
	}
	page := driver.ListPage{}
	if resp.NextContinuationToken != nil {
		page.NextPageToken = []byte(*resp.NextContinuationToken)
	}
	if n := len(resp.Contents) + len(resp.CommonPrefixes); n > 0 {
		page.Objects = make([]*driver.ListObject, n)
		for i, obj := range resp.Contents {
			obj := obj
			page.Objects[i] = &driver.ListObject{
				Key:     unescapeKey(aws.ToString(obj.Key)),
				ModTime: *obj.LastModified,
				Size:    aws.ToInt64(obj.Size),
				MD5:     eTagToMD5(obj.ETag),
				AsFunc: func(i any) bool {
					p, ok := i.(*types.Object)
					if !ok {
						return false
					}
					*p = obj
					return true
				},
			}
		}
		for i, prefix := range resp.CommonPrefixes {
			prefix := prefix
			page.Objects[i+len(resp.Contents)] = &driver.ListObject{
				Key:   unescapeKey(aws.ToString(prefix.Prefix)),
				IsDir: true,
				AsFunc: func(i any) bool {
					p, ok := i.(*types.CommonPrefix)
					if !ok {
						return false
					}
					*p = prefix
					return true
				},
			}
		}
		if len(resp.Contents) > 0 && len(resp.CommonPrefixes) > 0 {
			// S3 gives us blobs and "directories" in separate lists; sort them.
			sort.Slice(page.Objects, func(i, j int) bool {
				return page.Objects[i].Key < page.Objects[j].Key
			})
		}
	}
	return &page, nil
}

func (b *bucket) listObjects(ctx context.Context, in *s3.ListObjectsV2Input, opts *driver.ListOptions) (*s3.ListObjectsV2Output, error) {
	if !b.useLegacyList {
		var varopt []func(*s3.Options)
		if opts.BeforeList != nil {
			asFunc := func(i any) bool {
				if p, ok := i.(**s3.ListObjectsV2Input); ok {
					*p = in
					return true
				}
				if p, ok := i.(**[]func(*s3.Options)); ok {
					*p = &varopt
					return true
				}
				return false
			}
			if err := opts.BeforeList(asFunc); err != nil {
				return nil, err
			}
		}
		return b.client.ListObjectsV2(ctx, in, varopt...)
	}

	// Use the legacy ListObjects request.
	legacyIn := &s3.ListObjectsInput{
		Bucket:       in.Bucket,
		Delimiter:    in.Delimiter,
		EncodingType: in.EncodingType,
		Marker:       in.ContinuationToken,
		MaxKeys:      in.MaxKeys,
		Prefix:       in.Prefix,
		RequestPayer: in.RequestPayer,
	}
	if opts.BeforeList != nil {
		asFunc := func(i any) bool {
			p, ok := i.(**s3.ListObjectsInput)
			if !ok {
				return false
			}
			*p = legacyIn
			return true
		}
		if err := opts.BeforeList(asFunc); err != nil {
			return nil, err
		}
	}
	legacyResp, err := b.client.ListObjects(ctx, legacyIn)
	if err != nil {
		return nil, err
	}

	var nextContinuationToken *string
	if legacyResp.NextMarker != nil {
		nextContinuationToken = legacyResp.NextMarker
	} else if aws.ToBool(legacyResp.IsTruncated) {
		nextContinuationToken = aws.String(aws.ToString(legacyResp.Contents[len(legacyResp.Contents)-1].Key))
	}
	return &s3.ListObjectsV2Output{
		CommonPrefixes:        legacyResp.CommonPrefixes,
		Contents:              legacyResp.Contents,
		NextContinuationToken: nextContinuationToken,
	}, nil
}

// As implements driver.As.
func (b *bucket) As(i any) bool {
	p, ok := i.(**s3.Client)
	if !ok {
		return false
	}
	*p = b.client
	return true
}

// As implements driver.ErrorAs.
func (b *bucket) ErrorAs(err error, i any) bool {
	return errors.As(err, i)
}

// Attributes implements driver.Attributes.
func (b *bucket) Attributes(ctx context.Context, key string) (*driver.Attributes, error) {
	key = escapeKey(key)
	in := &s3.HeadObjectInput{
		Bucket: aws.String(b.name),
		Key:    aws.String(key),
	}
	resp, err := b.client.HeadObject(ctx, in)
	if err != nil {
		return nil, err
	}

	md := make(map[string]string, len(resp.Metadata))
	for k, v := range resp.Metadata {
		// See the package comments for more details on escaping of metadata
		// keys & values.
		md[escape.HexUnescape(escape.URLUnescape(k))] = escape.URLUnescape(v)
	}
	return &driver.Attributes{
		CacheControl:       aws.ToString(resp.CacheControl),
		ContentDisposition: aws.ToString(resp.ContentDisposition),
		ContentEncoding:    aws.ToString(resp.ContentEncoding),
		ContentLanguage:    aws.ToString(resp.ContentLanguage),
		ContentType:        aws.ToString(resp.ContentType),
		Metadata:           md,
		// CreateTime not supported; left as the zero time.
		ModTime: aws.ToTime(resp.LastModified),
		Size:    aws.ToInt64(resp.ContentLength),
		MD5:     eTagToMD5(resp.ETag),
		ETag:    aws.ToString(resp.ETag),
		AsFunc: func(i any) bool {
			p, ok := i.(*s3.HeadObjectOutput)
			if !ok {
				return false
			}
			*p = *resp
			return true
		},
	}, nil
}

// NewRangeReader implements driver.NewRangeReader.
func (b *bucket) NewRangeReader(ctx context.Context, key string, offset, length int64, opts *driver.ReaderOptions) (driver.Reader, error) {
	key = escapeKey(key)
	var byteRange *string
	if offset > 0 && length < 0 {
		byteRange = aws.String(fmt.Sprintf("bytes=%d-", offset))
	} else if length == 0 {
		// AWS doesn't support a zero-length read; we'll read 1 byte and then
		// ignore it in favor of http.NoBody below.
		byteRange = aws.String(fmt.Sprintf("bytes=%d-%d", offset, offset))
	} else if length >= 0 {
		byteRange = aws.String(fmt.Sprintf("bytes=%d-%d", offset, offset+length-1))
	}
	in := &s3.GetObjectInput{
		Bucket: aws.String(b.name),
		Key:    aws.String(key),
		Range:  byteRange,
	}
	var varopt []func(*s3.Options)
	if opts.BeforeRead != nil {
		asFunc := func(i any) bool {
			if p, ok := i.(**s3.GetObjectInput); ok {
				*p = in
				return true
			}
			if p, ok := i.(**[]func(*s3.Options)); ok {
				*p = &varopt
				return true
			}
			return false
		}
		if err := opts.BeforeRead(asFunc); err != nil {
			return nil, err
		}
	}
	resp, err := b.client.GetObject(ctx, in, varopt...)
	if err != nil {
		return nil, err
	}
	body := resp.Body
	if length == 0 {
		body = http.NoBody
	}
	return &reader{
		body: body,
		attrs: driver.ReaderAttributes{
			ContentType: aws.ToString(resp.ContentType),
			ModTime:     aws.ToTime(resp.LastModified),
			Size:        getSize(aws.ToInt64(resp.ContentLength), aws.ToString(resp.ContentRange)),
		},
		raw: resp,
	}, nil
}

// etagToMD5 processes an ETag header and returns an MD5 hash if possible.
// S3's ETag header is sometimes a quoted hexstring of the MD5. Other times,
// notably when the object was uploaded in multiple parts, it is not.
// We do the best we can.
// Some links about ETag:
// https://docs.aws.amazon.com/AmazonS3/latest/API/RESTCommonResponseHeaders.html
// https://github.com/aws/aws-sdk-net/issues/815
// https://teppen.io/2018/06/23/aws_s3_etags/
func eTagToMD5(etag *string) []byte {
	if etag == nil {
		// No header at all.
		return nil
	}
	// Strip the expected leading and trailing quotes.
	quoted := *etag
	if len(quoted) < 2 || quoted[0] != '"' || quoted[len(quoted)-1] != '"' {
		return nil
	}
	unquoted := quoted[1 : len(quoted)-1]
	// Un-hex; we return nil on error. In particular, we'll get an error here
	// for multi-part uploaded blobs, whose ETag will contain a "-" and so will
	// never be a legal hex encoding.
	md5, err := hex.DecodeString(unquoted)
	if err != nil {
		return nil
	}
	return md5
}

func getSize(contentLength int64, contentRange string) int64 {
	// Default size to ContentLength, but that's incorrect for partial-length reads,
	// where ContentLength refers to the size of the returned Body, not the entire
	// size of the blob. ContentRange has the full size.
	size := contentLength
	if contentRange != "" {
		// Sample: bytes 10-14/27 (where 27 is the full size).
		parts := strings.Split(contentRange, "/")
		if len(parts) == 2 {
			if i, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
				size = i
			}
		}
	}
	return size
}

// escapeKey does all required escaping for UTF-8 strings to work with S3.
func escapeKey(key string) string {
	return escape.HexEscape(key, func(r []rune, i int) bool {
		c := r[i]
		switch {
		// S3 doesn't handle these characters (determined via experimentation).
		case c < 32:
			return true
		// For "../", escape the trailing slash.
		case i > 1 && c == '/' && r[i-1] == '.' && r[i-2] == '.':
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
	uploader := s3manager.NewUploader(b.client, func(u *s3manager.Uploader) {
		if opts.BufferSize != 0 {
			u.PartSize = int64(opts.BufferSize)
		}
		if opts.MaxConcurrency != 0 {
			u.Concurrency = opts.MaxConcurrency
		}
	})
	md := make(map[string]string, len(opts.Metadata))
	for k, v := range opts.Metadata {
		// See the package comments for more details on escaping of metadata
		// keys & values.
		k = escape.HexEscape(url.PathEscape(k), func(runes []rune, i int) bool {
			c := runes[i]
			return c == '@' || c == ':' || c == '='
		})
		md[k] = url.PathEscape(v)
	}
	req := &s3.PutObjectInput{
		Bucket:      aws.String(b.name),
		ContentType: aws.String(contentType),
		Key:         aws.String(key),
		Metadata:    md,
	}

	if opts.IfNotExist {
		// See https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html
		req.IfNoneMatch = aws.String("*")
	}
	if opts.CacheControl != "" {
		req.CacheControl = aws.String(opts.CacheControl)
	}
	if opts.ContentDisposition != "" {
		req.ContentDisposition = aws.String(opts.ContentDisposition)
	}
	if opts.ContentEncoding != "" {
		req.ContentEncoding = aws.String(opts.ContentEncoding)
	}
	if opts.ContentLanguage != "" {
		req.ContentLanguage = aws.String(opts.ContentLanguage)
	}
	if len(opts.ContentMD5) > 0 {
		req.ContentMD5 = aws.String(base64.StdEncoding.EncodeToString(opts.ContentMD5))
	}
	if b.encryptionType != "" {
		req.ServerSideEncryption = b.encryptionType
	}
	if b.kmsKeyId != "" {
		req.SSEKMSKeyId = aws.String(b.kmsKeyId)
	}
	if opts.BeforeWrite != nil {
		asFunc := func(i any) bool {
			// Note that since the Go CDK Blob
			// abstraction does not expose AWS's
			// Uploader concept, there does not
			// appear to be any utility in
			// exposing the options list to the v2
			// Uploader's Upload() method.
			// Instead, applications can
			// manipulate the exposed *Uploader
			// directly, including by setting
			// ClientOptions if needed.
			if p, ok := i.(**s3manager.Uploader); ok {
				*p = uploader
				return true
			}
			if p, ok := i.(**s3.PutObjectInput); ok {
				*p = req
				return true
			}
			return false
		}
		if err := opts.BeforeWrite(asFunc); err != nil {
			return nil, err
		}
	}
	return &writer{
		ctx:      ctx,
		uploader: uploader,
		req:      req,
		donec:    make(chan struct{}),
	}, nil
}

// Copy implements driver.Copy.
func (b *bucket) Copy(ctx context.Context, dstKey, srcKey string, opts *driver.CopyOptions) error {
	dstKey = escapeKey(dstKey)
	srcKey = escapeKey(srcKey)
	srcKeyWithBucketEscaped := url.QueryEscape(b.name + "/" + srcKey)
	input := &s3.CopyObjectInput{
		Bucket:     aws.String(b.name),
		CopySource: aws.String(srcKeyWithBucketEscaped),
		Key:        aws.String(dstKey),
	}
	if b.encryptionType != "" {
		input.ServerSideEncryption = b.encryptionType
	}
	if b.kmsKeyId != "" {
		input.SSEKMSKeyId = aws.String(b.kmsKeyId)
	}
	if opts.BeforeCopy != nil {
		asFunc := func(i any) bool {
			switch v := i.(type) {
			case **s3.CopyObjectInput:
				*v = input
				return true
			}
			return false
		}
		if err := opts.BeforeCopy(asFunc); err != nil {
			return err
		}
	}
	_, err := b.client.CopyObject(ctx, input)
	return err
}

// Delete implements driver.Delete.
func (b *bucket) Delete(ctx context.Context, key string) error {
	if _, err := b.Attributes(ctx, key); err != nil {
		return err
	}
	key = escapeKey(key)
	input := &s3.DeleteObjectInput{
		Bucket: aws.String(b.name),
		Key:    aws.String(key),
	}
	_, err := b.client.DeleteObject(ctx, input)
	return err
}

func (b *bucket) SignedURL(ctx context.Context, key string, opts *driver.SignedURLOptions) (string, error) {
	key = escapeKey(key)
	switch opts.Method {
	case http.MethodGet:
		in := &s3.GetObjectInput{
			Bucket: aws.String(b.name),
			Key:    aws.String(key),
		}
		if opts.BeforeSign != nil {
			asFunc := func(i any) bool {
				v, ok := i.(**s3.GetObjectInput)
				if ok {
					*v = in
				}
				return ok
			}
			if err := opts.BeforeSign(asFunc); err != nil {
				return "", err
			}
		}
		p, err := s3.NewPresignClient(b.client, s3.WithPresignExpires(opts.Expiry)).PresignGetObject(ctx, in)
		if err != nil {
			return "", err
		}
		return p.URL, nil
	case http.MethodPut:
		in := &s3.PutObjectInput{
			Bucket: aws.String(b.name),
			Key:    aws.String(key),
		}
		if opts.EnforceAbsentContentType || opts.ContentType != "" {
			// https://github.com/aws/aws-sdk-go-v2/issues/1475
			return "", gcerr.New(gcerr.Unimplemented, nil, 1, "s3blob: AWS SDK v2 does not supported enforcing ContentType in SignedURLs for PUT")
		}
		if opts.BeforeSign != nil {
			asFunc := func(i any) bool {
				v, ok := i.(**s3.PutObjectInput)
				if ok {
					*v = in
				}
				return ok
			}
			if err := opts.BeforeSign(asFunc); err != nil {
				return "", err
			}
		}
		p, err := s3.NewPresignClient(b.client, s3.WithPresignExpires(opts.Expiry)).PresignPutObject(ctx, in)
		if err != nil {
			return "", err
		}
		return p.URL, nil
	case http.MethodDelete:
		// https://github.com/aws/aws-sdk-java-v2/issues/2520
		return "", gcerr.New(gcerr.Unimplemented, nil, 1, "s3blob: AWS SDK v2 does not support SignedURL for DELETE")
	default:
		return "", fmt.Errorf("unsupported Method %q", opts.Method)
	}
}
