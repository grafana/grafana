package manager

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/internal/awsutil"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go/logging"
)

const userAgentKey = "s3-transfer"

// DefaultDownloadPartSize is the default range of bytes to get at a time when
// using Download().
const DefaultDownloadPartSize = 1024 * 1024 * 5

// DefaultDownloadConcurrency is the default number of goroutines to spin up
// when using Download().
const DefaultDownloadConcurrency = 5

// DefaultPartBodyMaxRetries is the default number of retries to make when a part fails to download.
const DefaultPartBodyMaxRetries = 3

type errReadingBody struct {
	err error
}

func (e *errReadingBody) Error() string {
	return fmt.Sprintf("failed to read part body: %v", e.err)
}

func (e *errReadingBody) Unwrap() error {
	return e.err
}

// The Downloader structure that calls Download(). It is safe to call Download()
// on this structure for multiple objects and across concurrent goroutines.
// Mutating the Downloader's properties is not safe to be done concurrently.
type Downloader struct {
	// The size (in bytes) to request from S3 for each part.
	// The minimum allowed part size is 5MB, and  if this value is set to zero,
	// the DefaultDownloadPartSize value will be used.
	//
	// PartSize is ignored if the Range input parameter is provided.
	PartSize int64

	// PartBodyMaxRetries is the number of retry attempts to make for failed part downloads.
	PartBodyMaxRetries int

	// Logger to send logging messages to
	Logger logging.Logger

	// Enable Logging of part download retry attempts
	LogInterruptedDownloads bool

	// The number of goroutines to spin up in parallel when sending parts.
	// If this is set to zero, the DefaultDownloadConcurrency value will be used.
	//
	// Concurrency of 1 will download the parts sequentially.
	//
	// Concurrency is ignored if the Range input parameter is provided.
	Concurrency int

	// An S3 client to use when performing downloads.
	S3 DownloadAPIClient

	// List of client options that will be passed down to individual API
	// operation requests made by the downloader.
	ClientOptions []func(*s3.Options)

	// Defines the buffer strategy used when downloading a part.
	//
	// If a WriterReadFromProvider is given the Download manager
	// will pass the io.WriterAt of the Download request to the provider
	// and will use the returned WriterReadFrom from the provider as the
	// destination writer when copying from http response body.
	BufferProvider WriterReadFromProvider
}

// WithDownloaderClientOptions appends to the Downloader's API request options.
func WithDownloaderClientOptions(opts ...func(*s3.Options)) func(*Downloader) {
	return func(d *Downloader) {
		d.ClientOptions = append(d.ClientOptions, opts...)
	}
}

// NewDownloader creates a new Downloader instance to downloads objects from
// S3 in concurrent chunks. Pass in additional functional options  to customize
// the downloader behavior. Requires a client.ConfigProvider in order to create
// a S3 service client. The session.Session satisfies the client.ConfigProvider
// interface.
//
// Example:
//
//	// Load AWS Config
//	cfg, err := config.LoadDefaultConfig(context.TODO())
//	if err != nil {
//		panic(err)
//	}
//
//	// Create an S3 client using the loaded configuration
//	s3.NewFromConfig(cfg)
//
//	// Create a downloader passing it the S3 client
//	downloader := manager.NewDownloader(s3.NewFromConfig(cfg))
//
//	// Create a downloader with the client and custom downloader options
//	downloader := manager.NewDownloader(client, func(d *manager.Downloader) {
//		d.PartSize = 64 * 1024 * 1024 // 64MB per part
//	})
func NewDownloader(c DownloadAPIClient, options ...func(*Downloader)) *Downloader {
	d := &Downloader{
		S3:                 c,
		PartSize:           DefaultDownloadPartSize,
		PartBodyMaxRetries: DefaultPartBodyMaxRetries,
		Concurrency:        DefaultDownloadConcurrency,
		BufferProvider:     defaultDownloadBufferProvider(),
	}
	for _, option := range options {
		option(d)
	}

	return d
}

// Download downloads an object in S3 and writes the payload into w
// using concurrent GET requests. The n int64 returned is the size of the object downloaded
// in bytes.
//
// DownloadWithContext is the same as Download with the additional support for
// Context input parameters. The Context must not be nil. A nil Context will
// cause a panic. Use the Context to add deadlining, timeouts, etc. The
// DownloadWithContext may create sub-contexts for individual underlying
// requests.
//
// Additional functional options can be provided to configure the individual
// download. These options are copies of the Downloader instance Download is
// called from. Modifying the options will not impact the original Downloader
// instance. Use the WithDownloaderClientOptions helper function to pass in request
// options that will be applied to all API operations made with this downloader.
//
// The w io.WriterAt can be satisfied by an os.File to do multipart concurrent
// downloads, or in memory []byte wrapper using aws.WriteAtBuffer. In case you download
// files into memory do not forget to pre-allocate memory to avoid additional allocations
// and GC runs.
//
// Example:
//
//	// pre-allocate in memory buffer, where headObject type is *s3.HeadObjectOutput
//	buf := make([]byte, int(headObject.ContentLength))
//	// wrap with aws.WriteAtBuffer
//	w := manager.NewWriteAtBuffer(buf)
//	// download file into the memory
//	numBytesDownloaded, err := downloader.Download(ctx, w, &s3.GetObjectInput{
//		Bucket: aws.String(bucket),
//		Key:    aws.String(item),
//	})
//
// Specifying a Downloader.Concurrency of 1 will cause the Downloader to
// download the parts from S3 sequentially.
//
// It is safe to call this method concurrently across goroutines.
//
// If the GetObjectInput's Range value is provided that will cause the downloader
// to perform a single GetObjectInput request for that object's range. This will
// caused the part size, and concurrency configurations to be ignored.
func (d Downloader) Download(ctx context.Context, w io.WriterAt, input *s3.GetObjectInput, options ...func(*Downloader)) (n int64, err error) {
	if err := validateSupportedARNType(aws.ToString(input.Bucket)); err != nil {
		return 0, err
	}

	impl := downloader{w: w, in: input, cfg: d, ctx: ctx}

	// Copy ClientOptions
	clientOptions := make([]func(*s3.Options), 0, len(impl.cfg.ClientOptions)+1)
	clientOptions = append(clientOptions, func(o *s3.Options) {
		o.APIOptions = append(o.APIOptions,
			middleware.AddSDKAgentKey(middleware.FeatureMetadata, userAgentKey),
			addFeatureUserAgent, // yes, there are two of these
		)
	})
	clientOptions = append(clientOptions, impl.cfg.ClientOptions...)
	impl.cfg.ClientOptions = clientOptions

	for _, option := range options {
		option(&impl.cfg)
	}

	// Ensures we don't need nil checks later on
	impl.cfg.Logger = logging.WithContext(ctx, impl.cfg.Logger)

	impl.partBodyMaxRetries = d.PartBodyMaxRetries

	impl.totalBytes = -1
	if impl.cfg.Concurrency == 0 {
		impl.cfg.Concurrency = DefaultDownloadConcurrency
	}

	if impl.cfg.PartSize == 0 {
		impl.cfg.PartSize = DefaultDownloadPartSize
	}

	return impl.download()
}

// downloader is the implementation structure used internally by Downloader.
type downloader struct {
	ctx context.Context
	cfg Downloader

	in *s3.GetObjectInput
	w  io.WriterAt

	wg sync.WaitGroup
	m  sync.Mutex

	pos        int64
	totalBytes int64
	written    int64
	err        error

	partBodyMaxRetries int
}

// download performs the implementation of the object download across ranged
// GETs.
func (d *downloader) download() (n int64, err error) {
	// If range is specified fall back to single download of that range
	// this enables the functionality of ranged gets with the downloader but
	// at the cost of no multipart downloads.
	if rng := aws.ToString(d.in.Range); len(rng) > 0 {
		d.downloadRange(rng)
		return d.written, d.err
	}

	// Spin off first worker to check additional header information
	d.getChunk()

	if total := d.getTotalBytes(); total >= 0 {
		// Spin up workers
		ch := make(chan dlchunk, d.cfg.Concurrency)

		for i := 0; i < d.cfg.Concurrency; i++ {
			d.wg.Add(1)
			go d.downloadPart(ch)
		}

		// Assign work
		for d.getErr() == nil {
			if d.pos >= total {
				break // We're finished queuing chunks
			}

			// Queue the next range of bytes to read.
			ch <- dlchunk{w: d.w, start: d.pos, size: d.cfg.PartSize}
			d.pos += d.cfg.PartSize
		}

		// Wait for completion
		close(ch)
		d.wg.Wait()
	} else {
		// Checking if we read anything new
		for d.err == nil {
			d.getChunk()
		}

		// We expect a 416 error letting us know we are done downloading the
		// total bytes. Since we do not know the content's length, this will
		// keep grabbing chunks of data until the range of bytes specified in
		// the request is out of range of the content. Once, this happens, a
		// 416 should occur.
		var responseError interface {
			HTTPStatusCode() int
		}
		if errors.As(d.err, &responseError) {
			if responseError.HTTPStatusCode() == http.StatusRequestedRangeNotSatisfiable {
				d.err = nil
			}
		}
	}

	// Return error
	return d.written, d.err
}

// downloadPart is an individual goroutine worker reading from the ch channel
// and performing a GetObject request on the data with a given byte range.
//
// If this is the first worker, this operation also resolves the total number
// of bytes to be read so that the worker manager knows when it is finished.
func (d *downloader) downloadPart(ch chan dlchunk) {
	defer d.wg.Done()
	for {
		chunk, ok := <-ch
		if !ok {
			break
		}
		if d.getErr() != nil {
			// Drain the channel if there is an error, to prevent deadlocking
			// of download producer.
			continue
		}

		if err := d.downloadChunk(chunk); err != nil {
			d.setErr(err)
		}
	}
}

// getChunk grabs a chunk of data from the body.
// Not thread safe. Should only used when grabbing data on a single thread.
func (d *downloader) getChunk() {
	if d.getErr() != nil {
		return
	}

	chunk := dlchunk{w: d.w, start: d.pos, size: d.cfg.PartSize}
	d.pos += d.cfg.PartSize

	if err := d.downloadChunk(chunk); err != nil {
		d.setErr(err)
	}
}

// downloadRange downloads an Object given the passed in Byte-Range value.
// The chunk used down download the range will be configured for that range.
func (d *downloader) downloadRange(rng string) {
	if d.getErr() != nil {
		return
	}

	chunk := dlchunk{w: d.w, start: d.pos}
	// Ranges specified will short circuit the multipart download
	chunk.withRange = rng

	if err := d.downloadChunk(chunk); err != nil {
		d.setErr(err)
	}

	// Update the position based on the amount of data received.
	d.pos = d.written
}

// downloadChunk downloads the chunk from s3
func (d *downloader) downloadChunk(chunk dlchunk) error {
	var params s3.GetObjectInput
	awsutil.Copy(&params, d.in)

	// Get the next byte range of data
	params.Range = aws.String(chunk.ByteRange())

	var n int64
	var err error
	for retry := 0; retry <= d.partBodyMaxRetries; retry++ {
		n, err = d.tryDownloadChunk(&params, &chunk)
		if err == nil {
			break
		}
		// Check if the returned error is an errReadingBody.
		// If err is errReadingBody this indicates that an error
		// occurred while copying the http response body.
		// If this occurs we unwrap the err to set the underlying error
		// and attempt any remaining retries.
		if bodyErr, ok := err.(*errReadingBody); ok {
			err = bodyErr.Unwrap()
		} else {
			return err
		}

		chunk.cur = 0

		d.cfg.Logger.Logf(logging.Debug,
			"object part body download interrupted %s, err, %v, retrying attempt %d",
			aws.ToString(params.Key), err, retry)
	}

	d.incrWritten(n)

	return err
}

func (d *downloader) tryDownloadChunk(params *s3.GetObjectInput, w io.Writer) (int64, error) {
	cleanup := func() {}
	if d.cfg.BufferProvider != nil {
		w, cleanup = d.cfg.BufferProvider.GetReadFrom(w)
	}
	defer cleanup()

	resp, err := d.cfg.S3.GetObject(d.ctx, params, d.cfg.ClientOptions...)
	if err != nil {
		return 0, err
	}
	d.setTotalBytes(resp) // Set total if not yet set.

	var src io.Reader = resp.Body
	if d.cfg.BufferProvider != nil {
		src = &suppressWriterAt{suppressed: src}
	}
	n, err := io.Copy(w, src)
	resp.Body.Close()
	if err != nil {
		return n, &errReadingBody{err: err}
	}

	return n, nil
}

// getTotalBytes is a thread-safe getter for retrieving the total byte status.
func (d *downloader) getTotalBytes() int64 {
	d.m.Lock()
	defer d.m.Unlock()

	return d.totalBytes
}

// setTotalBytes is a thread-safe setter for setting the total byte status.
// Will extract the object's total bytes from the Content-Range if the file
// will be chunked, or Content-Length. Content-Length is used when the response
// does not include a Content-Range. Meaning the object was not chunked. This
// occurs when the full file fits within the PartSize directive.
func (d *downloader) setTotalBytes(resp *s3.GetObjectOutput) {
	d.m.Lock()
	defer d.m.Unlock()

	if d.totalBytes >= 0 {
		return
	}

	if resp.ContentRange == nil {
		// ContentRange is nil when the full file contents is provided, and
		// is not chunked. Use ContentLength instead.
		if aws.ToInt64(resp.ContentLength) > 0 {
			d.totalBytes = aws.ToInt64(resp.ContentLength)
			return
		}
	} else {
		parts := strings.Split(*resp.ContentRange, "/")

		total := int64(-1)
		var err error
		// Checking for whether or not a numbered total exists
		// If one does not exist, we will assume the total to be -1, undefined,
		// and sequentially download each chunk until hitting a 416 error
		totalStr := parts[len(parts)-1]
		if totalStr != "*" {
			total, err = strconv.ParseInt(totalStr, 10, 64)
			if err != nil {
				d.err = err
				return
			}
		}

		d.totalBytes = total
	}
}

func (d *downloader) incrWritten(n int64) {
	d.m.Lock()
	defer d.m.Unlock()

	d.written += n
}

// getErr is a thread-safe getter for the error object
func (d *downloader) getErr() error {
	d.m.Lock()
	defer d.m.Unlock()

	return d.err
}

// setErr is a thread-safe setter for the error object
func (d *downloader) setErr(e error) {
	d.m.Lock()
	defer d.m.Unlock()

	d.err = e
}

// dlchunk represents a single chunk of data to write by the worker routine.
// This structure also implements an io.SectionReader style interface for
// io.WriterAt, effectively making it an io.SectionWriter (which does not
// exist).
type dlchunk struct {
	w     io.WriterAt
	start int64
	size  int64
	cur   int64

	// specifies the byte range the chunk should be downloaded with.
	withRange string
}

// Write wraps io.WriterAt for the dlchunk, writing from the dlchunk's start
// position to its end (or EOF).
//
// If a range is specified on the dlchunk the size will be ignored when writing.
// as the total size may not of be known ahead of time.
func (c *dlchunk) Write(p []byte) (n int, err error) {
	if c.cur >= c.size && len(c.withRange) == 0 {
		return 0, io.EOF
	}

	n, err = c.w.WriteAt(p, c.start+c.cur)
	c.cur += int64(n)

	return
}

// ByteRange returns a HTTP Byte-Range header value that should be used by the
// client to request the chunk's range.
func (c *dlchunk) ByteRange() string {
	if len(c.withRange) != 0 {
		return c.withRange
	}

	return fmt.Sprintf("bytes=%d-%d", c.start, c.start+c.size-1)
}
