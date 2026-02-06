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

// Package blob provides an easy and portable way to interact with blobs
// within a storage location. Subpackages contain driver implementations of
// blob for supported services.
//
// See https://gocloud.dev/howto/blob/ for a detailed how-to guide.
//
// *blob.Bucket implements io/fs.FS and io/fs.SubFS, so it can be used with
// functions in that package.
//
// # Errors
//
// The errors returned from this package can be inspected in several ways:
//
// The Code function from gocloud.dev/gcerrors will return an error code, also
// defined in that package, when invoked on an error.
//
// The Bucket.ErrorAs method can retrieve the driver error underlying the returned
// error.
//
// # OpenTelemetry Integration
//
// OpenTelemetry supports tracing, metrics, and logs collection for multiple languages and
// backend providers. See https://opentelemetry.io.
//
// This API collects OpenTelemetry traces and metrics for the following methods:
//   - Attributes
//   - Copy
//   - Delete
//   - ListPage
//   - NewRangeReader, from creation until the call to Close. (NewReader and ReadAll
//     are included because they call NewRangeReader.)
//   - NewWriter, from creation until the call to Close.
//
// All trace and metric names begin with the package import path.
// The traces add the method name.
// For example, "gocloud.dev/blob/Attributes".
// The metrics are "completed_calls", a count of completed method calls by driver,
// method and status (error code); and "latency", a distribution of method latency
// by driver and method.
// For example, "gocloud.dev/blob/latency".
//
// It also collects the following metrics:
//   - gocloud.dev/blob/bytes_read: the total number of bytes read, by driver.
//   - gocloud.dev/blob/bytes_written: the total number of bytes written, by driver.
//
// To enable trace collection in your application, see the documentation at
// https://opentelemetry.io/docs/instrumentation/go/getting-started/.
// To enable metric collection in your application, see the documentation at
// https://opentelemetry.io/docs/instrumentation/go/manual/.
package blob // import "gocloud.dev/blob"

import (
	"bytes"
	"context"
	"crypto/md5"
	"fmt"
	"hash"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"runtime"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"go.opentelemetry.io/otel/metric"
	"gocloud.dev/blob/driver"
	"gocloud.dev/gcerrors"
	"gocloud.dev/internal/gcerr"
	"gocloud.dev/internal/openurl"
	gcdkotel "gocloud.dev/internal/otel"
)

// Ensure that Reader implements io.ReadSeekCloser.
var _ = io.ReadSeekCloser(&Reader{})

// Reader reads bytes from a blob.
// It implements io.ReadSeekCloser, and must be closed after
// reads are finished.
type Reader struct {
	b              driver.Bucket
	r              driver.Reader
	key            string
	ctx            context.Context       // Used to recreate r after Seeks
	dopts          *driver.ReaderOptions // "
	baseOffset     int64                 // The base offset provided to NewRangeReader.
	baseLength     int64                 // The length provided to NewRangeReader (may be negative).
	relativeOffset int64                 // Current offset (relative to baseOffset).
	savedOffset    int64                 // Last relativeOffset for r, saved after relativeOffset is changed in Seek, or -1 if no Seek.
	end            func(error)           // Called at Close to finish trace and metric collection.
	// for metric collection;
	bytesReadCounter metric.Int64Counter
	bytesRead        int
	closed           bool
}

// Read implements io.Reader (https://golang.org/pkg/io/#Reader).
func (r *Reader) Read(p []byte) (int, error) {
	if r.savedOffset != -1 {
		// We've done one or more Seeks since the last read. We may have
		// to recreate the Reader.
		//
		// Note that remembering the savedOffset and lazily resetting the
		// reader like this allows the caller to Seek, then Seek again back,
		// to the original offset, without having to recreate the reader.
		// We only have to recreate the reader if we actually read after a Seek.
		// This is an important optimization because it's common to Seek
		// to (SeekEnd, 0) and use the return value to determine the size
		// of the data, then Seek back to (SeekStart, 0).
		saved := r.savedOffset
		if r.relativeOffset == saved {
			// Nope! We're at the same place we left off.
			r.savedOffset = -1
		} else {
			// Yep! We've changed the offset. Recreate the reader.
			length := r.baseLength
			if length >= 0 {
				length -= r.relativeOffset
				if length < 0 {
					// Shouldn't happen based on checks in Seek.
					return 0, gcerr.Newf(gcerr.Internal, nil, "blob: invalid Seek (base length %d, relative offset %d)", r.baseLength, r.relativeOffset)
				}
			}
			newR, err := r.b.NewRangeReader(r.ctx, r.key, r.baseOffset+r.relativeOffset, length, r.dopts)
			if err != nil {
				return 0, wrapError(r.b, err, r.key)
			}
			_ = r.r.Close()
			r.savedOffset = -1
			r.r = newR
		}
	}
	n, err := r.r.Read(p)
	r.bytesRead += n
	r.relativeOffset += int64(n)
	return n, wrapError(r.b, err, r.key)
}

// Seek implements io.Seeker (https://golang.org/pkg/io/#Seeker).
func (r *Reader) Seek(offset int64, whence int) (int64, error) {
	if r.savedOffset == -1 {
		// Save the current offset for our reader. If the Seek changes the
		// offset, and then we try to read, we'll need to recreate the reader.
		// See comment above in Read for why we do it lazily.
		r.savedOffset = r.relativeOffset
	}
	// The maximum relative offset is the minimum of:
	// 1. The actual size of the blob, minus our initial baseOffset.
	// 2. The length provided to NewRangeReader (if it was non-negative).
	maxRelativeOffset := r.Size() - r.baseOffset
	if r.baseLength >= 0 && r.baseLength < maxRelativeOffset {
		maxRelativeOffset = r.baseLength
	}
	switch whence {
	case io.SeekStart:
		r.relativeOffset = offset
	case io.SeekCurrent:
		r.relativeOffset += offset
	case io.SeekEnd:
		r.relativeOffset = maxRelativeOffset + offset
	}
	if r.relativeOffset < 0 {
		// "Seeking to an offset before the start of the file is an error."
		invalidOffset := r.relativeOffset
		r.relativeOffset = 0
		return 0, fmt.Errorf("Seek resulted in invalid offset %d, using 0", invalidOffset)
	}
	if r.relativeOffset > maxRelativeOffset {
		// "Seeking to any positive offset is legal, but the behavior of subsequent
		// I/O operations on the underlying object is implementation-dependent."
		// We'll choose to set the offset to the EOF.
		log.Printf("blob.Reader.Seek set an offset after EOF (base offset/length from NewRangeReader %d, %d; actual blob size %d; relative offset %d -> absolute offset %d).", r.baseOffset, r.baseLength, r.Size(), r.relativeOffset, r.baseOffset+r.relativeOffset)
		r.relativeOffset = maxRelativeOffset
	}
	return r.relativeOffset, nil
}

// Close implements io.Closer (https://golang.org/pkg/io/#Closer).
func (r *Reader) Close() error {
	r.closed = true
	err := wrapError(r.b, r.r.Close(), r.key)
	r.end(err)
	// Emit only on close to avoid an allocation on each call to Read().
	// Record bytes read metric with OpenTelemetry.
	if r.bytesReadCounter != nil && r.bytesRead > 0 {
		r.bytesReadCounter.Add(
			r.ctx,
			int64(r.bytesRead))
	}
	return err
}

// ContentType returns the MIME type of the blob.
func (r *Reader) ContentType() string {
	return r.r.Attributes().ContentType
}

// ModTime returns the time the blob was last modified.
func (r *Reader) ModTime() time.Time {
	return r.r.Attributes().ModTime
}

// Size returns the size of the blob content in bytes.
func (r *Reader) Size() int64 {
	return r.r.Attributes().Size
}

// As converts i to driver-specific types.
// See https://gocloud.dev/concepts/as/ for background information, the "As"
// examples in this package for examples, and the driver package
// documentation for the specific types supported for that driver.
func (r *Reader) As(i any) bool {
	return r.r.As(i)
}

// WriteTo reads from r and writes to w until there's no more data or
// an error occurs.
// The return value is the number of bytes written to w.
//
// It implements the io.WriterTo interface.
func (r *Reader) WriteTo(w io.Writer) (int64, error) {
	// If the writer has a ReaderFrom method, use it to do the copy.
	// Don't do this for our own *Writer to avoid infinite recursion.
	// Avoids an allocation and a copy.
	switch w.(type) {
	case *Writer:
	default:
		if rf, ok := w.(io.ReaderFrom); ok {
			n, err := rf.ReadFrom(r)
			return n, err
		}
	}

	_, nw, err := readFromWriteTo(r, w)
	return nw, err
}

// downloadAndClose is similar to WriteTo, but ensures it's the only read.
// This pattern is more optimal for some drivers.
func (r *Reader) downloadAndClose(w io.Writer) (err error) {
	if r.bytesRead != 0 {
		// Shouldn't happen.
		return gcerr.Newf(gcerr.Internal, nil, "blob: downloadAndClose isn't the first read")
	}
	driverDownloader, ok := r.r.(driver.Downloader)
	if ok {
		err = driverDownloader.Download(w)
	} else {
		_, err = r.WriteTo(w)
	}
	cerr := r.Close()
	if err == nil && cerr != nil {
		err = cerr
	}
	return err
}

// readFromWriteTo is a helper for ReadFrom and WriteTo.
// It reads data from r and writes to w, until EOF or a read/write error.
// It returns the number of bytes read from r and the number of bytes
// written to w.
func readFromWriteTo(r io.Reader, w io.Writer) (int64, int64, error) {
	// Note: can't use io.Copy because it will try to use r.WriteTo
	// or w.WriteTo, which is recursive in this context.
	buf := make([]byte, 1024*1024)
	var totalRead, totalWritten int64
	for {
		numRead, rerr := r.Read(buf)
		if numRead > 0 {
			totalRead += int64(numRead)
			numWritten, werr := w.Write(buf[0:numRead])
			totalWritten += int64(numWritten)
			if werr != nil {
				return totalRead, totalWritten, werr
			}
		}
		if rerr == io.EOF {
			// Done!
			return totalRead, totalWritten, nil
		}
		if rerr != nil {
			return totalRead, totalWritten, rerr
		}
	}
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
	// ContentType is the MIME type of the blob. It will not be empty.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
	ContentType string
	// Metadata holds key/value pairs associated with the blob.
	// Keys are guaranteed to be in lowercase, even if the backend service
	// has case-sensitive keys (although note that Metadata written via
	// this package will always be lowercased). If there are duplicate
	// case-insensitive keys (e.g., "foo" and "FOO"), only one value
	// will be kept, and it is undefined which one.
	Metadata map[string]string
	// CreateTime is the time the blob was created, if available. If not available,
	// CreateTime will be the zero time.
	CreateTime time.Time
	// ModTime is the time the blob was last modified.
	ModTime time.Time
	// Size is the size of the blob's content in bytes.
	Size int64
	// MD5 is an MD5 hash of the blob contents or nil if not available.
	MD5 []byte
	// ETag for the blob; see https://en.wikipedia.org/wiki/HTTP_ETag.
	ETag string

	asFunc func(any) bool
}

// As converts i to driver-specific types.
// See https://gocloud.dev/concepts/as/ for background information, the "As"
// examples in this package for examples, and the driver package
// documentation for the specific types supported for that driver.
func (a *Attributes) As(i any) bool {
	if a.asFunc == nil {
		return false
	}
	return a.asFunc(i)
}

// Writer writes bytes to a blob.
//
// It implements io.WriteCloser (https://golang.org/pkg/io/#Closer), and must be
// closed after all writes are done.
type Writer struct {
	b          driver.Bucket
	w          driver.Writer
	key        string
	end        func(err error) // called at Close to finish trace and metric collection
	cancel     func()          // cancels the ctx provided to NewTypedWriter if contentMD5 verification fails
	contentMD5 []byte
	md5hash    hash.Hash

	// Metric collection fields.
	bytesWrittenCounter metric.Int64Counter
	bytesWritten        int
	closed              bool

	// These fields are non-zero values only when w is nil (not yet created).
	//
	// A ctx is stored in the Writer since we need to pass it into NewTypedWriter
	// when we finish detecting the content type of the blob and create the
	// underlying driver.Writer. This step happens inside Write or Close and
	// neither of them take a context.Context as an argument.
	//
	// All 3 fields are only initialized when we create the Writer without
	// setting the w field, and are reset to zero values after w is created.
	ctx  context.Context
	opts *driver.WriterOptions
	buf  *bytes.Buffer
}

// sniffLen is the byte size of Writer.buf used to detect content-type.
const sniffLen = 512

// Write implements the io.Writer interface (https://golang.org/pkg/io/#Writer).
//
// Writes may happen asynchronously, so the returned error can be nil
// even if the actual write eventually fails. The write is only guaranteed to
// have succeeded if Close returns no error.
func (w *Writer) Write(p []byte) (int, error) {
	if len(w.contentMD5) > 0 {
		if _, err := w.md5hash.Write(p); err != nil {
			return 0, err
		}
	}
	if w.w != nil {
		return w.write(p)
	}

	// If w is not yet created due to no content-type being passed in, try to sniff
	// the MIME type based on at most 512 bytes of the blob content of p.

	// Detect the content-type directly if the first chunk is at least 512 bytes.
	if w.buf.Len() == 0 && len(p) >= sniffLen {
		return w.open(p)
	}

	// Store p in w.buf and detect the content-type when the size of content in
	// w.buf is at least 512 bytes.
	n, err := w.buf.Write(p)
	if err != nil {
		return 0, err
	}
	if w.buf.Len() >= sniffLen {
		// Note that w.open will return the full length of the buffer; we don't want
		// to return that as the length of this write since some of them were written in
		// previous writes. Instead, we return the n from this write, above.
		_, err := w.open(w.buf.Bytes())
		return n, err
	}
	return n, nil
}

// Close closes the blob writer. The write operation is not guaranteed to have succeeded until
// Close returns with no error.
// Close may return an error if the context provided to create the Writer is
// canceled or reaches its deadline.
func (w *Writer) Close() (err error) {
	w.closed = true
	defer func() {
		w.end(err)
		// Emit only on close to avoid an allocation on each call to Write().
		// Record bytes written metric with OpenTelemetry.
		if w.bytesWrittenCounter != nil && w.bytesWritten > 0 {
			w.bytesWrittenCounter.Add(
				w.ctx,
				int64(w.bytesWritten))
		}
	}()
	if len(w.contentMD5) > 0 {
		// Verify the MD5 hash of what was written matches the ContentMD5 provided
		// by the user.
		md5sum := w.md5hash.Sum(nil)
		if !bytes.Equal(md5sum, w.contentMD5) {
			// No match! Return an error, but first cancel the context and call the
			// driver's Close function to ensure the write is aborted.
			w.cancel()
			if w.w != nil {
				_ = w.w.Close()
			}
			return gcerr.Newf(gcerr.FailedPrecondition, nil, "blob: the WriterOptions.ContentMD5 you specified (%X) did not match what was written (%X)", w.contentMD5, md5sum)
		}
	}

	defer w.cancel()
	if w.w != nil {
		return wrapError(w.b, w.w.Close(), w.key)
	}
	if _, err := w.open(w.buf.Bytes()); err != nil {
		return err
	}
	return wrapError(w.b, w.w.Close(), w.key)
}

// open tries to detect the MIME type of p and write it to the blob.
// The error it returns is wrapped.
func (w *Writer) open(p []byte) (int, error) {
	ct := http.DetectContentType(p)
	var err error
	if w.w, err = w.b.NewTypedWriter(w.ctx, w.key, ct, w.opts); err != nil {
		return 0, wrapError(w.b, err, w.key)
	}
	// Set the 3 fields needed for lazy NewTypedWriter back to zero values
	// (see the comment on Writer).
	w.buf = nil
	w.ctx = nil
	w.opts = nil
	return w.write(p)
}

func (w *Writer) write(p []byte) (int, error) {
	n, err := w.w.Write(p)
	w.bytesWritten += n
	return n, wrapError(w.b, err, w.key)
}

// ReadFrom reads from r and writes to w until EOF or error.
// The return value is the number of bytes read from r.
//
// It implements the io.ReaderFrom interface.
func (w *Writer) ReadFrom(r io.Reader) (int64, error) {
	// If the reader has a WriteTo method, use it to do the copy.
	// Don't do this for our own *Reader to avoid infinite recursion.
	// Avoids an allocation and a copy.
	switch r.(type) {
	case *Reader:
	default:
		if wt, ok := r.(io.WriterTo); ok {
			n, err := wt.WriteTo(w)
			return n, err
		}
	}

	nr, _, err := readFromWriteTo(r, w)
	return nr, err
}

// uploadAndClose is similar to ReadFrom, but ensures it's the only write.
// This pattern is more optimal for some drivers.
func (w *Writer) uploadAndClose(r io.Reader) (err error) {
	if w.bytesWritten != 0 {
		// Shouldn't happen.
		return gcerr.Newf(gcerr.Internal, nil, "blob: uploadAndClose must be the first write")
	}
	// When ContentMD5 is being checked, we can't use Upload.
	if len(w.contentMD5) > 0 {
		_, err = w.ReadFrom(r)
	} else {
		driverUploader, ok := w.w.(driver.Uploader)
		if ok {
			err = driverUploader.Upload(r)
		} else {
			_, err = w.ReadFrom(r)
		}
	}
	cerr := w.Close()
	if err == nil && cerr != nil {
		err = cerr
	}
	return err
}

// ListOptions sets options for listing blobs via Bucket.List.
type ListOptions struct {
	// Prefix indicates that only blobs with a key starting with this prefix
	// should be returned.
	Prefix string
	// Delimiter sets the delimiter used to define a hierarchical namespace,
	// like a filesystem with "directories". It is highly recommended that you
	// use "" or "/" as the Delimiter. Other values should work through this API,
	// but service UIs generally assume "/".
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

	// BeforeList is a callback that will be called before each call to the
	// the underlying service's list functionality.
	// asFunc converts its argument to driver-specific types.
	// See https://gocloud.dev/concepts/as/ for background information.
	BeforeList func(asFunc func(any) bool) error
}

// ListIterator iterates over List results.
type ListIterator struct {
	b       *Bucket
	opts    *driver.ListOptions
	page    *driver.ListPage
	nextIdx int
}

// Next returns a *ListObject for the next blob. It returns (nil, io.EOF) if
// there are no more.
func (i *ListIterator) Next(ctx context.Context) (*ListObject, error) {
	if i.page != nil {
		// We've already got a page of results.
		if i.nextIdx < len(i.page.Objects) {
			// Next object is in the page; return it.
			dobj := i.page.Objects[i.nextIdx]
			i.nextIdx++
			return &ListObject{
				Key:     dobj.Key,
				ModTime: dobj.ModTime,
				Size:    dobj.Size,
				MD5:     dobj.MD5,
				IsDir:   dobj.IsDir,
				asFunc:  dobj.AsFunc,
			}, nil
		}
		if len(i.page.NextPageToken) == 0 {
			// Done with current page, and there are no more; return io.EOF.
			return nil, io.EOF
		}
		// We need to load the next page.
		i.opts.PageToken = i.page.NextPageToken
	}
	i.b.mu.RLock()
	defer i.b.mu.RUnlock()
	if i.b.closed {
		return nil, errClosed
	}
	// Loading a new page.
	p, err := i.b.b.ListPaged(ctx, i.opts)
	if err != nil {
		return nil, wrapError(i.b.b, err, "")
	}
	i.page = p
	i.nextIdx = 0
	return i.Next(ctx)
}

// ListObject represents a single blob returned from List.
type ListObject struct {
	// Key is the key for this blob.
	Key string
	// ModTime is the time the blob was last modified.
	ModTime time.Time
	// Size is the size of the blob's content in bytes.
	Size int64
	// MD5 is an MD5 hash of the blob contents or nil if not available.
	MD5 []byte
	// IsDir indicates that this result represents a "directory" in the
	// hierarchical namespace, ending in ListOptions.Delimiter. Key can be
	// passed as ListOptions.Prefix to list items in the "directory".
	// Fields other than Key and IsDir will not be set if IsDir is true.
	IsDir bool

	asFunc func(any) bool
}

// As converts i to driver-specific types.
// See https://gocloud.dev/concepts/as/ for background information, the "As"
// examples in this package for examples, and the driver package
// documentation for the specific types supported for that driver.
func (o *ListObject) As(i any) bool {
	if o.asFunc == nil {
		return false
	}
	return o.asFunc(i)
}

// Bucket provides an easy and portable way to interact with blobs
// within a "bucket", including read, write, and list operations.
// To create a Bucket, use constructors found in driver subpackages.
type Bucket struct {
	b      driver.Bucket
	tracer *gcdkotel.Tracer

	bytesReadCounter    metric.Int64Counter
	bytesWrittenCounter metric.Int64Counter

	// ioFSCallback is set via SetIOFSCallback, which must be
	// called before calling various functions implementing interfaces
	// from the io/fs package.
	ioFSCallback func() (context.Context, *ReaderOptions)

	// mu protects the closed variable.
	// Read locks are kept to allow holding a read lock for long-running calls,
	// and thereby prevent closing until a call finishes.
	mu     sync.RWMutex
	closed bool
}

const pkgName = "gocloud.dev/blob"

var (

	// OpenTelemetryViews are predefined views for OpenTelemetry metrics.
	// The views include counts and latency distributions for API method calls.
	// See the explanations at https://opentelemetry.io/docs/specs/otel/metrics/data-model/ for usage.
	OpenTelemetryViews = append(
		append(
			gcdkotel.Views(pkgName),
			gcdkotel.CounterView(pkgName, "/bytes_read", "Sum of bytes read from the service.")...),
		gcdkotel.CounterView(pkgName, "/bytes_written", "Sum of bytes written to the service.")...)
)

// NewBucket is intended for use by drivers only. Do not use in application code.
var NewBucket = newBucket

// newBucket creates a new *Bucket based on a specific driver implementation.
// End users should use subpackages to construct a *Bucket instead of this
// function; see the package documentation for details.
func newBucket(b driver.Bucket) *Bucket {
	providerName := gcdkotel.ProviderName(b)

	return &Bucket{
		b:                   b,
		ioFSCallback:        func() (context.Context, *ReaderOptions) { return context.Background(), nil },
		tracer:              gcdkotel.NewTracer(pkgName, providerName),
		bytesReadCounter:    gcdkotel.BytesMeasure(pkgName, providerName, "/bytes_read", "Total bytes read from blob storage"),
		bytesWrittenCounter: gcdkotel.BytesMeasure(pkgName, providerName, "/bytes_written", "Total bytes written to blob storage"),
	}
}

// As converts i to driver-specific types.
// See https://gocloud.dev/concepts/as/ for background information, the "As"
// examples in this package for examples, and the driver package
// documentation for the specific types supported for that driver.
func (b *Bucket) As(i any) bool {
	if i == nil {
		return false
	}
	return b.b.As(i)
}

// ErrorAs converts err to driver-specific types.
// ErrorAs panics if i is nil or not a pointer.
// ErrorAs returns false if err == nil.
// See https://gocloud.dev/concepts/as/ for background information.
func (b *Bucket) ErrorAs(err error, i any) bool {
	return gcerr.ErrorAs(err, i, b.b.ErrorAs)
}

// ReadAll is a shortcut for creating a Reader via NewReader with nil
// ReaderOptions, and reading the entire blob.
//
// Using Download may be more efficient.
func (b *Bucket) ReadAll(ctx context.Context, key string) (_ []byte, err error) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return nil, errClosed
	}
	r, err := b.NewReader(ctx, key, nil)
	if err != nil {
		return nil, err
	}
	defer func() { _ = r.Close() }()
	return io.ReadAll(r)
}

// Download writes the content of a blob into an io.Writer w.
func (b *Bucket) Download(ctx context.Context, key string, w io.Writer, opts *ReaderOptions) error {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return errClosed
	}
	r, err := b.NewReader(ctx, key, opts)
	if err != nil {
		return err
	}
	return r.downloadAndClose(w)
}

// List returns a ListIterator that can be used to iterate over blobs in a
// bucket, in lexicographical order of UTF-8 encoded keys. The underlying
// implementation fetches results in pages.
//
// A nil ListOptions is treated the same as the zero value.
//
// List is not guaranteed to include all recently-written blobs;
// some services are only eventually consistent.
func (b *Bucket) List(opts *ListOptions) *ListIterator {
	if opts == nil {
		opts = &ListOptions{}
	}
	dopts := &driver.ListOptions{
		Prefix:     opts.Prefix,
		Delimiter:  opts.Delimiter,
		BeforeList: opts.BeforeList,
	}
	return &ListIterator{b: b, opts: dopts}
}

// FirstPageToken is the pageToken to pass to ListPage to retrieve the first page of results.
var FirstPageToken = []byte("first page")

// ListPage returns a page of ListObject results for blobs in a bucket, in lexicographical
// order of UTF-8 encoded keys.
//
// To fetch the first page, pass FirstPageToken as the pageToken. For subsequent pages, pass
// the pageToken returned from a previous call to ListPage.
// It is not possible to "skip ahead" pages.
//
// Each call will return pageSize results, unless there are not enough blobs to fill the
// page, in which case it will return fewer results (possibly 0).
//
// If there are no more blobs available, ListPage will return an empty pageToken. Note that
// this may happen regardless of the number of returned results -- the last page might have
// 0 results (i.e., if the last item was deleted), pageSize results, or anything in between.
//
// Calling ListPage with an empty pageToken will immediately return io.EOF. When looping
// over pages, callers can either check for an empty pageToken, or they can make one more
// call and check for io.EOF.
//
// The underlying implementation fetches results in pages, but one call to ListPage may
// require multiple page fetches (and therefore, multiple calls to the BeforeList callback).
//
// A nil ListOptions is treated the same as the zero value.
//
// ListPage is not guaranteed to include all recently-written blobs;
// some services are only eventually consistent.
func (b *Bucket) ListPage(ctx context.Context, pageToken []byte, pageSize int, opts *ListOptions) (retval []*ListObject, nextPageToken []byte, err error) {
	if opts == nil {
		opts = &ListOptions{}
	}
	if pageSize <= 0 {
		return nil, nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: pageSize must be > 0")
	}

	// Nil pageToken means no more results.
	if len(pageToken) == 0 {
		return nil, nil, io.EOF
	}

	// FirstPageToken fetches the first page. Drivers use nil.
	// The public API doesn't use nil for the first page because it would be too easy to
	// keep fetching forever (since the last page return nil for the next pageToken).
	if bytes.Equal(pageToken, FirstPageToken) {
		pageToken = nil
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return nil, nil, errClosed
	}

	ctx, span := b.tracer.Start(ctx, "ListPage")
	defer func() { b.tracer.End(ctx, span, err) }()

	dopts := &driver.ListOptions{
		Prefix:     opts.Prefix,
		Delimiter:  opts.Delimiter,
		BeforeList: opts.BeforeList,
		PageToken:  pageToken,
		PageSize:   pageSize,
	}
	retval = make([]*ListObject, 0, pageSize)
	for len(retval) < pageSize {
		p, err := b.b.ListPaged(ctx, dopts)
		if err != nil {
			return nil, nil, wrapError(b.b, err, "")
		}
		for _, dobj := range p.Objects {
			retval = append(retval, &ListObject{
				Key:     dobj.Key,
				ModTime: dobj.ModTime,
				Size:    dobj.Size,
				MD5:     dobj.MD5,
				IsDir:   dobj.IsDir,
				asFunc:  dobj.AsFunc,
			})
		}
		// ListPaged may return fewer results than pageSize. If there are more results
		// available, signalled by non-empty p.NextPageToken, try to fetch the remainder
		// of the page.
		// It does not work to ask for more results than we need, because then we'd have
		// a NextPageToken on a non-page boundary.
		dopts.PageSize = pageSize - len(retval)
		dopts.PageToken = p.NextPageToken
		if len(dopts.PageToken) == 0 {
			dopts.PageToken = nil
			break
		}
	}
	return retval, dopts.PageToken, nil
}

// IsAccessible returns true if the bucket is accessible, false otherwise.
// It is a shortcut for calling ListPage and checking if it returns an error
// with code gcerrors.NotFound.
func (b *Bucket) IsAccessible(ctx context.Context) (bool, error) {
	_, _, err := b.ListPage(ctx, FirstPageToken, 1, nil)
	if err == nil {
		return true, nil
	}
	if gcerrors.Code(err) == gcerrors.NotFound {
		return false, nil
	}
	return false, err
}

// Exists returns true if a blob exists at key, false if it does not exist, or
// an error.
// It is a shortcut for calling Attributes and checking if it returns an error
// with code gcerrors.NotFound.
func (b *Bucket) Exists(ctx context.Context, key string) (bool, error) {
	_, err := b.Attributes(ctx, key)
	if err == nil {
		return true, nil
	}
	if gcerrors.Code(err) == gcerrors.NotFound {
		return false, nil
	}
	return false, err
}

// Attributes returns attributes for the blob stored at key.
//
// If the blob does not exist, Attributes returns an error for which
// gcerrors.Code will return gcerrors.NotFound.
func (b *Bucket) Attributes(ctx context.Context, key string) (_ *Attributes, err error) {
	if !utf8.ValidString(key) {
		return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: Attributes key must be a valid UTF-8 string: %q", key)
	}

	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return nil, errClosed
	}
	ctx, span := b.tracer.Start(ctx, "Attributes")
	defer func() { b.tracer.End(ctx, span, err) }()

	a, err := b.b.Attributes(ctx, key)
	if err != nil {
		return nil, wrapError(b.b, err, key)
	}
	var md map[string]string
	if len(a.Metadata) > 0 {
		// Services are inconsistent, but at least some treat keys
		// as case-insensitive. To make the behavior consistent, we
		// force-lowercase them when writing and reading.
		md = make(map[string]string, len(a.Metadata))
		for k, v := range a.Metadata {
			md[strings.ToLower(k)] = v
		}
	}
	return &Attributes{
		CacheControl:       a.CacheControl,
		ContentDisposition: a.ContentDisposition,
		ContentEncoding:    a.ContentEncoding,
		ContentLanguage:    a.ContentLanguage,
		ContentType:        a.ContentType,
		Metadata:           md,
		CreateTime:         a.CreateTime,
		ModTime:            a.ModTime,
		Size:               a.Size,
		MD5:                a.MD5,
		ETag:               a.ETag,
		asFunc:             a.AsFunc,
	}, nil
}

// NewReader is a shortcut for NewRangeReader with offset=0 and length=-1.
func (b *Bucket) NewReader(ctx context.Context, key string, opts *ReaderOptions) (*Reader, error) {
	return b.newRangeReader(ctx, key, 0, -1, opts)
}

// NewRangeReader returns a Reader to read content from the blob stored at key.
// It reads at most length bytes starting at offset (>= 0).
// If length is negative, it will read till the end of the blob.
//
// For the purposes of Seek, the returned Reader will start at offset and
// end at the minimum of the actual end of the blob or (if length > 0) offset + length.
//
// Note that ctx is used for all reads performed during the lifetime of the reader.
//
// If the blob does not exist, NewRangeReader returns an error for which
// gcerrors.Code will return gcerrors.NotFound. Exists is a lighter-weight way
// to check for existence.
//
// A nil ReaderOptions is treated the same as the zero value.
//
// The caller must call Close on the returned Reader when done reading.
func (b *Bucket) NewRangeReader(ctx context.Context, key string, offset, length int64, opts *ReaderOptions) (_ *Reader, err error) {
	return b.newRangeReader(ctx, key, offset, length, opts)
}

func (b *Bucket) newRangeReader(ctx context.Context, key string, offset, length int64, opts *ReaderOptions) (_ *Reader, err error) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return nil, errClosed
	}
	if offset < 0 {
		return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: NewRangeReader offset must be non-negative (%d)", offset)
	}
	if !utf8.ValidString(key) {
		return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: NewRangeReader key must be a valid UTF-8 string: %q", key)
	}
	if opts == nil {
		opts = &ReaderOptions{}
	}
	dopts := &driver.ReaderOptions{
		BeforeRead: opts.BeforeRead,
	}
	ctx, span := b.tracer.Start(ctx, "NewRangeReader")
	defer func() {
		// If err == nil, we handed the end closure off to the returned *Reader; it
		// will be called when the Reader is Closed.
		if err != nil {
			b.tracer.End(ctx, span, err)
		}
	}()
	var dr driver.Reader
	dr, err = b.b.NewRangeReader(ctx, key, offset, length, dopts)
	if err != nil {
		return nil, wrapError(b.b, err, key)
	}
	end := func(err error) { b.tracer.End(ctx, span, err) }
	r := &Reader{
		b:                b.b,
		r:                dr,
		key:              key,
		ctx:              ctx,
		dopts:            dopts,
		baseOffset:       offset,
		baseLength:       length,
		savedOffset:      -1,
		end:              end,
		bytesReadCounter: b.bytesReadCounter,
	}
	_, file, lineno, ok := runtime.Caller(2)
	runtime.SetFinalizer(r, func(r *Reader) {
		if !r.closed {
			var caller string
			if ok {
				caller = fmt.Sprintf(" (%s:%d)", file, lineno)
			}
			log.Printf("A blob.Reader reading from %q was never closed%s", key, caller)
		}
	})
	return r, nil
}

// WriteAll is a shortcut for creating a Writer via NewWriter and writing p.
//
// If opts.ContentMD5 is not set, WriteAll will compute the MD5 of p and use it
// as the ContentMD5 option for the Writer it creates.
//
// Using Upload may be more efficient.
func (b *Bucket) WriteAll(ctx context.Context, key string, p []byte, opts *WriterOptions) (err error) {
	realOpts := new(WriterOptions)
	if opts != nil {
		*realOpts = *opts
	}
	if len(realOpts.ContentMD5) == 0 {
		sum := md5.Sum(p)
		realOpts.ContentMD5 = sum[:]
	}
	w, err := b.NewWriter(ctx, key, realOpts)
	if err != nil {
		return err
	}
	if _, err := w.Write(p); err != nil {
		_ = w.Close()
		return err
	}
	return w.Close()
}

// Upload reads from an io.Reader r and writes into a blob.
//
// opts.ContentType is required.
func (b *Bucket) Upload(ctx context.Context, key string, r io.Reader, opts *WriterOptions) error {
	if opts == nil || opts.ContentType == "" {
		return gcerr.Newf(gcerr.InvalidArgument, nil, "blob: Upload requires WriterOptions.ContentType")
	}
	w, err := b.NewWriter(ctx, key, opts)
	if err != nil {
		return err
	}
	return w.uploadAndClose(r)
}

// NewWriter returns a Writer that writes to the blob stored at key.
// A nil WriterOptions is treated the same as the zero value.
//
// If a blob with this key already exists, it will be replaced.
// The blob being written is not guaranteed to be readable until Close
// has been called; until then, any previous blob will still be readable.
// Even after Close is called, newly written blobs are not guaranteed to be
// returned from List; some services are only eventually consistent.
//
// The returned Writer will store ctx for later use in Write and/or Close.
// To abort a write, cancel ctx; otherwise, it must remain open until
// Close is called.
//
// The caller must call Close on the returned Writer, even if the write is
// aborted.
func (b *Bucket) NewWriter(ctx context.Context, key string, opts *WriterOptions) (_ *Writer, err error) {
	if !utf8.ValidString(key) {
		return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: NewWriter key must be a valid UTF-8 string: %q", key)
	}
	if opts == nil {
		opts = &WriterOptions{}
	}
	dopts := &driver.WriterOptions{
		CacheControl:                opts.CacheControl,
		ContentDisposition:          opts.ContentDisposition,
		ContentEncoding:             opts.ContentEncoding,
		ContentLanguage:             opts.ContentLanguage,
		ContentMD5:                  opts.ContentMD5,
		BufferSize:                  opts.BufferSize,
		MaxConcurrency:              opts.MaxConcurrency,
		BeforeWrite:                 opts.BeforeWrite,
		DisableContentTypeDetection: opts.DisableContentTypeDetection,
		IfNotExist:                  opts.IfNotExist,
	}
	if len(opts.Metadata) > 0 {
		// Services are inconsistent, but at least some treat keys
		// as case-insensitive. To make the behavior consistent, we
		// force-lowercase them when writing and reading.
		md := make(map[string]string, len(opts.Metadata))
		for k, v := range opts.Metadata {
			if k == "" {
				return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: WriterOptions.Metadata keys may not be empty strings")
			}
			if !utf8.ValidString(k) {
				return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: WriterOptions.Metadata keys must be valid UTF-8 strings: %q", k)
			}
			if !utf8.ValidString(v) {
				return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: WriterOptions.Metadata values must be valid UTF-8 strings: %q", v)
			}
			lowerK := strings.ToLower(k)
			if _, found := md[lowerK]; found {
				return nil, gcerr.Newf(gcerr.InvalidArgument, nil, "blob: WriterOptions.Metadata has a duplicate case-insensitive metadata key: %q", lowerK)
			}
			md[lowerK] = v
		}
		dopts.Metadata = md
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return nil, errClosed
	}
	ctx, cancel := context.WithCancel(ctx)
	ctx, span := b.tracer.Start(ctx, "NewWriter")
	end := func(err error) { b.tracer.End(ctx, span, err) }
	defer func() {
		if err != nil {
			end(err)
		}
	}()

	w := &Writer{
		b:                   b.b,
		end:                 end,
		cancel:              cancel,
		key:                 key,
		contentMD5:          opts.ContentMD5,
		md5hash:             md5.New(),
		bytesWrittenCounter: b.bytesWrittenCounter,
	}
	if opts.ContentType != "" || opts.DisableContentTypeDetection {
		var ct string
		if opts.ContentType != "" {
			t, p, err := mime.ParseMediaType(opts.ContentType)
			if err != nil {
				cancel()
				return nil, err
			}
			ct = mime.FormatMediaType(t, p)
		}
		dw, err := b.b.NewTypedWriter(ctx, key, ct, dopts)
		if err != nil {
			cancel()
			return nil, wrapError(b.b, err, key)
		}
		w.w = dw
	} else {
		// Save the fields needed to called NewTypedWriter later, once we've gotten
		// sniffLen bytes; see the comment on Writer.
		w.ctx = ctx
		w.opts = dopts
		w.buf = bytes.NewBuffer([]byte{})
	}
	_, file, lineno, ok := runtime.Caller(1)
	runtime.SetFinalizer(w, func(w *Writer) {
		if !w.closed {
			var caller string
			if ok {
				caller = fmt.Sprintf(" (%s:%d)", file, lineno)
			}
			log.Printf("A blob.Writer writing to %q was never closed%s", key, caller)
		}
	})
	return w, nil
}

// Copy the blob stored at srcKey to dstKey.
// A nil CopyOptions is treated the same as the zero value.
//
// If the source blob does not exist, Copy returns an error for which
// gcerrors.Code will return gcerrors.NotFound.
//
// If the destination blob already exists, it is overwritten.
func (b *Bucket) Copy(ctx context.Context, dstKey, srcKey string, opts *CopyOptions) (err error) {
	if !utf8.ValidString(srcKey) {
		return gcerr.Newf(gcerr.InvalidArgument, nil, "blob: Copy srcKey must be a valid UTF-8 string: %q", srcKey)
	}
	if !utf8.ValidString(dstKey) {
		return gcerr.Newf(gcerr.InvalidArgument, nil, "blob: Copy dstKey must be a valid UTF-8 string: %q", dstKey)
	}
	if opts == nil {
		opts = &CopyOptions{}
	}
	dopts := &driver.CopyOptions{
		BeforeCopy: opts.BeforeCopy,
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return errClosed
	}
	ctx, span := b.tracer.Start(ctx, "Copy")
	defer func() { b.tracer.End(ctx, span, err) }()
	return wrapError(b.b, b.b.Copy(ctx, dstKey, srcKey, dopts), fmt.Sprintf("%s -> %s", srcKey, dstKey))
}

// Delete deletes the blob stored at key.
//
// If the blob does not exist, Delete returns an error for which
// gcerrors.Code will return gcerrors.NotFound.
func (b *Bucket) Delete(ctx context.Context, key string) (err error) {
	if !utf8.ValidString(key) {
		return gcerr.Newf(gcerr.InvalidArgument, nil, "blob: Delete key must be a valid UTF-8 string: %q", key)
	}
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return errClosed
	}
	ctx, span := b.tracer.Start(ctx, "Delete")
	defer func() { b.tracer.End(ctx, span, err) }()
	return wrapError(b.b, b.b.Delete(ctx, key), key)
}

// SignedURL returns a URL that can be used to GET (default), PUT or DELETE
// the blob for the duration specified in opts.Expiry.
//
// A nil SignedURLOptions is treated the same as the zero value.
//
// It is valid to call SignedURL for a key that does not exist.
//
// If the driver does not support this functionality, SignedURL
// will return an error for which gcerrors.Code will return gcerrors.Unimplemented.
func (b *Bucket) SignedURL(ctx context.Context, key string, opts *SignedURLOptions) (string, error) {
	if !utf8.ValidString(key) {
		return "", gcerr.Newf(gcerr.InvalidArgument, nil, "blob: SignedURL key must be a valid UTF-8 string: %q", key)
	}
	dopts := new(driver.SignedURLOptions)
	if opts == nil {
		opts = new(SignedURLOptions)
	}
	switch {
	case opts.Expiry < 0:
		return "", gcerr.Newf(gcerr.InvalidArgument, nil, "blob: SignedURLOptions.Expiry must be >= 0 (%v)", opts.Expiry)
	case opts.Expiry == 0:
		dopts.Expiry = DefaultSignedURLExpiry
	default:
		dopts.Expiry = opts.Expiry
	}
	switch opts.Method {
	case "":
		dopts.Method = http.MethodGet
	case http.MethodGet, http.MethodPut, http.MethodDelete:
		dopts.Method = opts.Method
	default:
		return "", fmt.Errorf("blob: unsupported SignedURLOptions.Method %q", opts.Method)
	}
	if opts.ContentType != "" && opts.Method != http.MethodPut {
		return "", fmt.Errorf("blob: SignedURLOptions.ContentType must be empty for signing a %s URL", opts.Method)
	}
	if opts.EnforceAbsentContentType && opts.Method != http.MethodPut {
		return "", fmt.Errorf("blob: SignedURLOptions.EnforceAbsentContentType must be false for signing a %s URL", opts.Method)
	}
	dopts.ContentType = opts.ContentType
	dopts.EnforceAbsentContentType = opts.EnforceAbsentContentType
	dopts.BeforeSign = opts.BeforeSign
	b.mu.RLock()
	defer b.mu.RUnlock()
	if b.closed {
		return "", errClosed
	}
	sURL, err := b.b.SignedURL(ctx, key, dopts)
	return sURL, wrapError(b.b, err, key)
}

// Close releases any resources used for the bucket.
func (b *Bucket) Close() error {
	b.mu.Lock()
	prev := b.closed
	b.closed = true
	b.mu.Unlock()
	if prev {
		return errClosed
	}
	return wrapError(b.b, b.b.Close(), "")
}

// DefaultSignedURLExpiry is the default duration for SignedURLOptions.Expiry.
const DefaultSignedURLExpiry = 1 * time.Hour

// SignedURLOptions sets options for SignedURL.
type SignedURLOptions struct {
	// Expiry sets how long the returned URL is valid for.
	// Defaults to DefaultSignedURLExpiry.
	Expiry time.Duration

	// Method is the HTTP method that can be used on the URL; one of "GET", "PUT",
	// or "DELETE". Defaults to "GET".
	Method string

	// ContentType specifies the Content-Type HTTP header the user agent is
	// permitted to use in the PUT request. It must match exactly. See
	// EnforceAbsentContentType for behavior when ContentType is the empty string.
	// If a bucket does not implement this verification, then it returns an
	// Unimplemented error.
	//
	// Must be empty for non-PUT requests.
	ContentType string

	// If EnforceAbsentContentType is true and ContentType is the empty string,
	// then PUTing to the signed URL will fail if the Content-Type header is
	// present. Not all buckets support this: ones that do not will return an
	// Unimplemented error.
	//
	// If EnforceAbsentContentType is false and ContentType is the empty string,
	// then PUTing without a Content-Type header will succeed, but it is
	// implementation-specific whether providing a Content-Type header will fail.
	//
	// Must be false for non-PUT requests.
	EnforceAbsentContentType bool

	// BeforeSign is a callback that will be called before each call to the
	// the underlying service's sign functionality.
	// asFunc converts its argument to driver-specific types.
	// See https://gocloud.dev/concepts/as/ for background information.
	BeforeSign func(asFunc func(any) bool) error
}

// ReaderOptions sets options for NewReader and NewRangeReader.
type ReaderOptions struct {
	// BeforeRead is a callback that will be called before
	// any data is read (unless NewReader returns an error before then, in which
	// case it may not be called at all).
	//
	// Calling Seek may reset the underlying reader, and result in BeforeRead
	// getting called again with a different underlying provider-specific reader..
	//
	// asFunc converts its argument to driver-specific types.
	// See https://gocloud.dev/concepts/as/ for background information.
	BeforeRead func(asFunc func(any) bool) error
}

// WriterOptions sets options for NewWriter.
type WriterOptions struct {
	// BufferSize changes the default size in bytes of the chunks that
	// Writer will upload in a single request; larger blobs will be split into
	// multiple requests.
	//
	// This option may be ignored by some drivers.
	//
	// If 0, the driver will choose a reasonable default.
	//
	// If the Writer is used to do many small writes concurrently, using a
	// smaller BufferSize may reduce memory usage.
	BufferSize int

	// MaxConcurrency changes the default concurrency for parts of an upload.
	//
	// This option may be ignored by some drivers.
	//
	// If 0, the driver will choose a reasonable default.
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

	// ContentType specifies the MIME type of the blob being written. If not set,
	// it will be inferred from the content using the algorithm described at
	// http://mimesniff.spec.whatwg.org/.
	// Set DisableContentTypeDetection to true to disable the above and force
	// the ContentType to stay empty.
	// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
	ContentType string

	// When true, if ContentType is the empty string, it will stay the empty
	// string rather than being inferred from the content.
	// Note that while the blob will be written with an empty string ContentType,
	// most providers will fill one in during reads, so don't expect an empty
	// ContentType if you read the blob back.
	DisableContentTypeDetection bool

	// ContentMD5 is used as a message integrity check.
	// If len(ContentMD5) > 0, the MD5 hash of the bytes written must match
	// ContentMD5, or Close will return an error without completing the write.
	// https://tools.ietf.org/html/rfc1864
	ContentMD5 []byte

	// Metadata holds key/value strings to be associated with the blob, or nil.
	// Keys may not be empty, and are lowercased before being written.
	// Duplicate case-insensitive keys (e.g., "foo" and "FOO") will result in
	// an error.
	Metadata map[string]string

	// BeforeWrite is a callback that will be called exactly once, before
	// any data is written (unless NewWriter returns an error, in which case
	// it will not be called at all). Note that this is not necessarily during
	// or after the first Write call, as drivers may buffer bytes before
	// sending an upload request.
	//
	// asFunc converts its argument to driver-specific types.
	// See https://gocloud.dev/concepts/as/ for background information.
	BeforeWrite func(asFunc func(any) bool) error

	// IfNotExist is used for conditional writes. When set to 'true',
	// if a blob exists for the same key in the bucket, the write
	// operation won't succeed and the current blob for the key will
	// be left untouched. An error for which gcerrors.Code will return
	// gcerrors.PreconditionFailed will be returned by Write or Close.
	IfNotExist bool
}

// CopyOptions sets options for Copy.
type CopyOptions struct {
	// BeforeCopy is a callback that will be called before the copy is
	// initiated.
	//
	// asFunc converts its argument to driver-specific types.
	// See https://gocloud.dev/concepts/as/ for background information.
	BeforeCopy func(asFunc func(any) bool) error
}

// BucketURLOpener represents types that can open buckets based on a URL.
// The opener must not modify the URL argument. OpenBucketURL must be safe to
// call from multiple goroutines.
//
// This interface is generally implemented by types in driver packages.
type BucketURLOpener interface {
	OpenBucketURL(ctx context.Context, u *url.URL) (*Bucket, error)
}

// URLMux is a URL opener multiplexer. It matches the scheme of the URLs
// against a set of registered schemes and calls the opener that matches the
// URL's scheme.
// See https://gocloud.dev/concepts/urls/ for more information.
//
// The zero value is a multiplexer with no registered schemes.
type URLMux struct {
	schemes openurl.SchemeMap
}

// BucketSchemes returns a sorted slice of the registered Bucket schemes.
func (mux *URLMux) BucketSchemes() []string { return mux.schemes.Schemes() }

// ValidBucketScheme returns true iff scheme has been registered for Buckets.
func (mux *URLMux) ValidBucketScheme(scheme string) bool { return mux.schemes.ValidScheme(scheme) }

// RegisterBucket registers the opener with the given scheme. If an opener
// already exists for the scheme, RegisterBucket panics.
func (mux *URLMux) RegisterBucket(scheme string, opener BucketURLOpener) {
	mux.schemes.Register("blob", "Bucket", scheme, opener)
}

// OpenBucket calls OpenBucketURL with the URL parsed from urlstr.
// OpenBucket is safe to call from multiple goroutines.
func (mux *URLMux) OpenBucket(ctx context.Context, urlstr string) (*Bucket, error) {
	opener, u, err := mux.schemes.FromString("Bucket", urlstr)
	if err != nil {
		return nil, err
	}
	return applyPrefixParam(ctx, opener.(BucketURLOpener), u)
}

// OpenBucketURL dispatches the URL to the opener that is registered with the
// URL's scheme. OpenBucketURL is safe to call from multiple goroutines.
func (mux *URLMux) OpenBucketURL(ctx context.Context, u *url.URL) (*Bucket, error) {
	opener, err := mux.schemes.FromURL("Bucket", u)
	if err != nil {
		return nil, err
	}
	return applyPrefixParam(ctx, opener.(BucketURLOpener), u)
}

func applyPrefixParam(ctx context.Context, opener BucketURLOpener, u *url.URL) (*Bucket, error) {
	prefix := u.Query().Get("prefix")
	singleKey := u.Query().Get("key")
	if prefix != "" || singleKey != "" {
		// Make a copy of u with the "prefix" and "key" parameters removed.
		urlCopy := *u
		q := urlCopy.Query()
		q.Del("prefix")
		q.Del("key")
		urlCopy.RawQuery = q.Encode()
		u = &urlCopy
	}
	bucket, err := opener.OpenBucketURL(ctx, u)
	if err != nil {
		return nil, err
	}
	if prefix != "" {
		bucket = PrefixedBucket(bucket, prefix)
	}
	if singleKey != "" {
		bucket = SingleKeyBucket(bucket, singleKey)
	}
	return bucket, nil
}

var defaultURLMux = new(URLMux)

// DefaultURLMux returns the URLMux used by OpenBucket.
//
// Driver packages can use this to register their BucketURLOpener on the mux.
func DefaultURLMux() *URLMux {
	return defaultURLMux
}

// OpenBucket opens the bucket identified by the URL given.
//
// See the URLOpener documentation in driver subpackages for
// details on supported URL formats, and https://gocloud.dev/concepts/urls/
// for more information.
//
// In addition to driver-specific query parameters, OpenBucket supports
// the following query parameters:
//
//   - prefix: wraps the resulting Bucket using PrefixedBucket with the
//     given prefix.
//   - key: wraps the resulting Bucket using SingleKeyBucket with the
//     given key.
func OpenBucket(ctx context.Context, urlstr string) (*Bucket, error) {
	return defaultURLMux.OpenBucket(ctx, urlstr)
}

func wrapError(b driver.Bucket, err error, key string) error {
	if err == nil {
		return nil
	}
	if gcerr.DoNotWrap(err) {
		return err
	}
	msg := "blob"
	if key != "" {
		msg += fmt.Sprintf(" (key %q)", key)
	}
	code := gcerrors.Code(err)
	if code == gcerrors.Unknown {
		code = b.ErrorCode(err)
	}
	return gcerr.New(code, err, 2, msg)
}

var errClosed = gcerr.Newf(gcerr.FailedPrecondition, nil, "blob: Bucket has been closed")

// PrefixedBucket returns a *Bucket based on b with all keys modified to have
// prefix, which will usually end with a "/" to target a subdirectory in the
// bucket.
//
// bucket will be closed and no longer usable after this function returns.
func PrefixedBucket(bucket *Bucket, prefix string) *Bucket {
	bucket.mu.Lock()
	defer bucket.mu.Unlock()
	bucket.closed = true
	return NewBucket(driver.NewPrefixedBucket(bucket.b, prefix))
}

// SingleKeyBucket returns a *Bucket based on b that always references singleKey.
// List methods will not work.
// singleKey acts as srcKey for Copy.
//
// bucket will be closed and no longer usable after this function returns.
func SingleKeyBucket(bucket *Bucket, singleKey string) *Bucket {
	bucket.mu.Lock()
	defer bucket.mu.Unlock()
	bucket.closed = true
	return NewBucket(driver.NewSingleKeyBucket(bucket.b, singleKey))
}
