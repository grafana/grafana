package manager

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/middleware"
	"github.com/aws/aws-sdk-go-v2/internal/awsutil"
	internalcontext "github.com/aws/aws-sdk-go-v2/internal/context"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	smithymiddleware "github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// MaxUploadParts is the maximum allowed number of parts in a multi-part upload
// on Amazon S3.
const MaxUploadParts int32 = 10000

// MinUploadPartSize is the minimum allowed part size when uploading a part to
// Amazon S3.
const MinUploadPartSize int64 = 1024 * 1024 * 5

// DefaultUploadPartSize is the default part size to buffer chunks of a
// payload into.
const DefaultUploadPartSize = MinUploadPartSize

// DefaultUploadConcurrency is the default number of goroutines to spin up when
// using Upload().
const DefaultUploadConcurrency = 5

// A MultiUploadFailure wraps a failed S3 multipart upload. An error returned
// will satisfy this interface when a multi part upload failed to upload all
// chucks to S3. In the case of a failure the UploadID is needed to operate on
// the chunks, if any, which were uploaded.
//
// Example:
//
//	u := manager.NewUploader(client)
//	output, err := u.upload(context.Background(), input)
//	if err != nil {
//		var multierr manager.MultiUploadFailure
//		if errors.As(err, &multierr) {
//			fmt.Printf("upload failure UploadID=%s, %s\n", multierr.UploadID(), multierr.Error())
//		} else {
//			fmt.Printf("upload failure, %s\n", err.Error())
//		}
//	}
type MultiUploadFailure interface {
	error

	// UploadID returns the upload id for the S3 multipart upload that failed.
	UploadID() string
}

// A multiUploadError wraps the upload ID of a failed s3 multipart upload.
// Composed of BaseError for code, message, and original error
//
// Should be used for an error that occurred failing a S3 multipart upload,
// and a upload ID is available. If an uploadID is not available a more relevant
type multiUploadError struct {
	err error

	// ID for multipart upload which failed.
	uploadID string
}

// batchItemError returns the string representation of the error.
//
// # See apierr.BaseError ErrorWithExtra for output format
//
// Satisfies the error interface.
func (m *multiUploadError) Error() string {
	var extra string
	if m.err != nil {
		extra = fmt.Sprintf(", cause: %s", m.err.Error())
	}
	return fmt.Sprintf("upload multipart failed, upload id: %s%s", m.uploadID, extra)
}

// Unwrap returns the underlying error that cause the upload failure
func (m *multiUploadError) Unwrap() error {
	return m.err
}

// UploadID returns the id of the S3 upload which failed.
func (m *multiUploadError) UploadID() string {
	return m.uploadID
}

// UploadOutput represents a response from the Upload() call.
type UploadOutput struct {
	// The URL where the object was uploaded to.
	Location string

	// The ID for a multipart upload to S3. In the case of an error the error
	// can be cast to the MultiUploadFailure interface to extract the upload ID.
	// Will be empty string if multipart upload was not used, and the object
	// was uploaded as a single PutObject call.
	UploadID string

	// The list of parts that were uploaded and their checksums. Will be empty
	// if multipart upload was not used, and the object was uploaded as a
	// single PutObject call.
	CompletedParts []types.CompletedPart

	// Indicates whether the uploaded object uses an S3 Bucket Key for server-side
	// encryption with Amazon Web Services KMS (SSE-KMS).
	BucketKeyEnabled bool

	// The base64-encoded, 32-bit CRC32 checksum of the object.
	ChecksumCRC32 *string

	// The base64-encoded, 32-bit CRC32C checksum of the object.
	ChecksumCRC32C *string

	// The base64-encoded, 64-bit CRC64NVME checksum of the object.
	ChecksumCRC64NVME *string

	// The base64-encoded, 160-bit SHA-1 digest of the object.
	ChecksumSHA1 *string

	// The base64-encoded, 256-bit SHA-256 digest of the object.
	ChecksumSHA256 *string

	// Entity tag for the uploaded object.
	ETag *string

	// If the object expiration is configured, this will contain the expiration date
	// (expiry-date) and rule ID (rule-id). The value of rule-id is URL encoded.
	Expiration *string

	// The object key of the newly created object.
	Key *string

	// If present, indicates that the requester was successfully charged for the
	// request.
	RequestCharged types.RequestCharged

	// If present, specifies the ID of the Amazon Web Services Key Management Service
	// (Amazon Web Services KMS) symmetric customer managed customer master key (CMK)
	// that was used for the object.
	SSEKMSKeyId *string

	// If you specified server-side encryption either with an Amazon S3-managed
	// encryption key or an Amazon Web Services KMS customer master key (CMK) in your
	// initiate multipart upload request, the response includes this header. It
	// confirms the encryption algorithm that Amazon S3 used to encrypt the object.
	ServerSideEncryption types.ServerSideEncryption

	// The version of the object that was uploaded. Will only be populated if
	// the S3 Bucket is versioned. If the bucket is not versioned this field
	// will not be set.
	VersionID *string
}

// WithUploaderRequestOptions appends to the Uploader's API client options.
func WithUploaderRequestOptions(opts ...func(*s3.Options)) func(*Uploader) {
	return func(u *Uploader) {
		u.ClientOptions = append(u.ClientOptions, opts...)
	}
}

// The Uploader structure that calls Upload(). It is safe to call Upload()
// on this structure for multiple objects and across concurrent goroutines.
// Mutating the Uploader's properties is not safe to be done concurrently.
//
// # Pre-computed Checksums
//
// Care must be taken when using pre-computed checksums the transfer upload
// manager. The format and value of the checksum differs based on if the upload
// will preformed as a single or multipart upload.
//
// Uploads that are smaller than the Uploader's PartSize will be uploaded using
// the PutObject API operation. Pre-computed checksum of the uploaded object's
// content are valid for these single part uploads. If the checksum provided
// does not match the uploaded content the upload will fail.
//
// Uploads that are larger than the Uploader's PartSize will be uploaded using
// multi-part upload. The Pre-computed checksums for these uploads are a
// checksum of checksums of each part. Not a checksum of the full uploaded
// bytes. With the format of "<checksum of checksum>-<numberParts>", (e.g.
// "DUoRhQ==-3"). If a pre-computed checksum is provided that does not match
// this format, as matches the content uploaded, the upload will fail.
//
// ContentMD5 for multipart upload is explicitly ignored for multipart upload,
// and its value is suppressed.
//
// # Automatically Computed Checksums
//
// When the ChecksumAlgorithm member of Upload's input parameter PutObjectInput
// is set to a valid value, the SDK will automatically compute the checksum of
// the individual uploaded parts. The UploadOutput result from Upload will
// include the checksum of part checksums provided by S3
// CompleteMultipartUpload API call.
type Uploader struct {
	// The buffer size (in bytes) to use when buffering data into chunks and
	// sending them as parts to S3. The minimum allowed part size is 5MB, and
	// if this value is set to zero, the DefaultUploadPartSize value will be used.
	PartSize int64

	// The number of goroutines to spin up in parallel per call to Upload when
	// sending parts. If this is set to zero, the DefaultUploadConcurrency value
	// will be used.
	//
	// The concurrency pool is not shared between calls to Upload.
	Concurrency int

	// Setting this value to true will cause the SDK to avoid calling
	// AbortMultipartUpload on a failure, leaving all successfully uploaded
	// parts on S3 for manual recovery.
	//
	// Note that storing parts of an incomplete multipart upload counts towards
	// space usage on S3 and will add additional costs if not cleaned up.
	LeavePartsOnError bool

	// MaxUploadParts is the max number of parts which will be uploaded to S3.
	// Will be used to calculate the partsize of the object to be uploaded.
	// E.g: 5GB file, with MaxUploadParts set to 100, will upload the file
	// as 100, 50MB parts. With a limited of s3.MaxUploadParts (10,000 parts).
	//
	// MaxUploadParts must not be used to limit the total number of bytes uploaded.
	// Use a type like to io.LimitReader (https://golang.org/pkg/io/#LimitedReader)
	// instead. An io.LimitReader is helpful when uploading an unbounded reader
	// to S3, and you know its maximum size. Otherwise the reader's io.EOF returned
	// error must be used to signal end of stream.
	//
	// Defaults to package const's MaxUploadParts value.
	MaxUploadParts int32

	// The client to use when uploading to S3.
	S3 UploadAPIClient

	// List of request options that will be passed down to individual API
	// operation requests made by the uploader.
	ClientOptions []func(*s3.Options)

	// Defines the buffer strategy used when uploading a part
	BufferProvider ReadSeekerWriteToProvider

	// partPool allows for the re-usage of streaming payload part buffers between upload calls
	partPool byteSlicePool
}

// NewUploader creates a new Uploader instance to upload objects to S3. Pass In
// additional functional options to customize the uploader's behavior. Requires a
// client.ConfigProvider in order to create a S3 service client. The session.Session
// satisfies the client.ConfigProvider interface.
//
// Example:
//
//	// Load AWS Config
//	cfg, err := config.LoadDefaultConfig(context.TODO())
//	if err != nil {
//		panic(err)
//	}
//
//	// Create an S3 Client with the config
//	client := s3.NewFromConfig(cfg)
//
//	// Create an uploader passing it the client
//	uploader := manager.NewUploader(client)
//
//	// Create an uploader with the client and custom options
//	uploader := manager.NewUploader(client, func(u *manager.Uploader) {
//		u.PartSize = 64 * 1024 * 1024 // 64MB per part
//	})
func NewUploader(client UploadAPIClient, options ...func(*Uploader)) *Uploader {
	u := &Uploader{
		S3:                client,
		PartSize:          DefaultUploadPartSize,
		Concurrency:       DefaultUploadConcurrency,
		LeavePartsOnError: false,
		MaxUploadParts:    MaxUploadParts,
		BufferProvider:    defaultUploadBufferProvider(),
	}

	for _, option := range options {
		option(u)
	}

	u.partPool = newByteSlicePool(u.PartSize)

	return u
}

// Upload uploads an object to S3, intelligently buffering large
// files into smaller chunks and sending them in parallel across multiple
// goroutines. You can configure the buffer size and concurrency through the
// Uploader parameters.
//
// Additional functional options can be provided to configure the individual
// upload. These options are copies of the Uploader instance Upload is called from.
// Modifying the options will not impact the original Uploader instance.
//
// Use the WithUploaderRequestOptions helper function to pass in request
// options that will be applied to all API operations made with this uploader.
//
// It is safe to call this method concurrently across goroutines.
func (u Uploader) Upload(ctx context.Context, input *s3.PutObjectInput, opts ...func(*Uploader)) (
	*UploadOutput, error,
) {
	i := uploader{in: input, cfg: u, ctx: ctx}

	// Copy ClientOptions
	clientOptions := make([]func(*s3.Options), 0, len(i.cfg.ClientOptions)+1)
	clientOptions = append(clientOptions, func(o *s3.Options) {
		o.APIOptions = append(o.APIOptions,
			middleware.AddSDKAgentKey(middleware.FeatureMetadata, userAgentKey),
			addFeatureUserAgent, // yes, there are two of these
			func(s *smithymiddleware.Stack) error {
				return s.Finalize.Insert(&setS3ExpressDefaultChecksum{}, "ResolveEndpointV2", smithymiddleware.After)
			},
		)
	})
	clientOptions = append(clientOptions, i.cfg.ClientOptions...)
	i.cfg.ClientOptions = clientOptions

	for _, opt := range opts {
		opt(&i.cfg)
	}

	return i.upload()
}

// internal structure to manage an upload to S3.
type uploader struct {
	ctx context.Context
	cfg Uploader

	in *s3.PutObjectInput

	readerPos int64 // current reader position
	totalSize int64 // set to -1 if the size is not known
}

// internal logic for deciding whether to upload a single part or use a
// multipart upload.
func (u *uploader) upload() (*UploadOutput, error) {
	if err := u.init(); err != nil {
		return nil, fmt.Errorf("unable to initialize upload: %w", err)
	}
	defer u.cfg.partPool.Close()

	if u.cfg.PartSize < MinUploadPartSize {
		return nil, fmt.Errorf("part size must be at least %d bytes", MinUploadPartSize)
	}

	// Do one read to determine if we have more than one part
	reader, _, cleanup, err := u.nextReader()
	if err == io.EOF { // single part
		return u.singlePart(reader, cleanup)
	} else if err != nil {
		cleanup()
		return nil, fmt.Errorf("read upload data failed: %w", err)
	}

	mu := multiuploader{uploader: u}
	return mu.upload(reader, cleanup)
}

// init will initialize all default options.
func (u *uploader) init() error {
	if err := validateSupportedARNType(aws.ToString(u.in.Bucket)); err != nil {
		return err
	}

	if u.cfg.Concurrency == 0 {
		u.cfg.Concurrency = DefaultUploadConcurrency
	}
	if u.cfg.PartSize == 0 {
		u.cfg.PartSize = DefaultUploadPartSize
	}
	if u.cfg.MaxUploadParts == 0 {
		u.cfg.MaxUploadParts = MaxUploadParts
	}

	// Try to get the total size for some optimizations
	if err := u.initSize(); err != nil {
		return err
	}

	// If PartSize was changed or partPool was never setup then we need to allocated a new pool
	// so that we return []byte slices of the correct size
	poolCap := u.cfg.Concurrency + 1
	if u.cfg.partPool == nil || u.cfg.partPool.SliceSize() != u.cfg.PartSize {
		u.cfg.partPool = newByteSlicePool(u.cfg.PartSize)
		u.cfg.partPool.ModifyCapacity(poolCap)
	} else {
		u.cfg.partPool = &returnCapacityPoolCloser{byteSlicePool: u.cfg.partPool}
		u.cfg.partPool.ModifyCapacity(poolCap)
	}

	return nil
}

// initSize tries to detect the total stream size, setting u.totalSize. If
// the size is not known, totalSize is set to -1.
func (u *uploader) initSize() error {
	u.totalSize = -1

	switch r := u.in.Body.(type) {
	case io.Seeker:
		n, err := seekerLen(r)
		if err != nil {
			return err
		}
		u.totalSize = n

		// Try to adjust partSize if it is too small and account for
		// integer division truncation.
		if u.totalSize/u.cfg.PartSize >= int64(u.cfg.MaxUploadParts) {
			// Add one to the part size to account for remainders
			// during the size calculation. e.g odd number of bytes.
			u.cfg.PartSize = (u.totalSize / int64(u.cfg.MaxUploadParts)) + 1
		}
	}

	return nil
}

// nextReader returns a seekable reader representing the next packet of data.
// This operation increases the shared u.readerPos counter, but note that it
// does not need to be wrapped in a mutex because nextReader is only called
// from the main thread.
func (u *uploader) nextReader() (io.ReadSeeker, int, func(), error) {
	switch r := u.in.Body.(type) {
	case readerAtSeeker:
		var err error

		n := u.cfg.PartSize
		if u.totalSize >= 0 {
			bytesLeft := u.totalSize - u.readerPos

			if bytesLeft <= u.cfg.PartSize {
				err = io.EOF
				n = bytesLeft
			}
		}

		var (
			reader  io.ReadSeeker
			cleanup func()
		)

		reader = io.NewSectionReader(r, u.readerPos, n)
		if u.cfg.BufferProvider != nil {
			reader, cleanup = u.cfg.BufferProvider.GetWriteTo(reader)
		} else {
			cleanup = func() {}
		}

		u.readerPos += n

		return reader, int(n), cleanup, err

	default:
		part, err := u.cfg.partPool.Get(u.ctx)
		if err != nil {
			return nil, 0, func() {}, err
		}

		n, err := readFillBuf(r, *part)
		u.readerPos += int64(n)

		cleanup := func() {
			u.cfg.partPool.Put(part)
		}

		return bytes.NewReader((*part)[0:n]), n, cleanup, err
	}
}

func readFillBuf(r io.Reader, b []byte) (offset int, err error) {
	for offset < len(b) && err == nil {
		var n int
		n, err = r.Read(b[offset:])
		offset += n
	}

	return offset, err
}

// singlePart contains upload logic for uploading a single chunk via
// a regular PutObject request. Multipart requests require at least two
// parts, or at least 5MB of data.
func (u *uploader) singlePart(r io.ReadSeeker, cleanup func()) (*UploadOutput, error) {
	defer cleanup()

	var params s3.PutObjectInput
	awsutil.Copy(&params, u.in)
	params.Body = r

	// Need to use request form because URL generated in request is
	// used in return.

	var locationRecorder recordLocationClient
	out, err := u.cfg.S3.PutObject(u.ctx, &params,
		append(u.cfg.ClientOptions, locationRecorder.WrapClient())...)
	if err != nil {
		return nil, err
	}

	return &UploadOutput{
		Location: locationRecorder.location,

		BucketKeyEnabled:     aws.ToBool(out.BucketKeyEnabled),
		ChecksumCRC32:        out.ChecksumCRC32,
		ChecksumCRC32C:       out.ChecksumCRC32C,
		ChecksumCRC64NVME:    out.ChecksumCRC64NVME,
		ChecksumSHA1:         out.ChecksumSHA1,
		ChecksumSHA256:       out.ChecksumSHA256,
		ETag:                 out.ETag,
		Expiration:           out.Expiration,
		Key:                  params.Key,
		RequestCharged:       out.RequestCharged,
		SSEKMSKeyId:          out.SSEKMSKeyId,
		ServerSideEncryption: out.ServerSideEncryption,
		VersionID:            out.VersionId,
	}, nil
}

type httpClient interface {
	Do(r *http.Request) (*http.Response, error)
}

type recordLocationClient struct {
	httpClient
	location string
}

func (c *recordLocationClient) WrapClient() func(o *s3.Options) {
	return func(o *s3.Options) {
		c.httpClient = o.HTTPClient
		o.HTTPClient = c
	}
}

func (c *recordLocationClient) Do(r *http.Request) (resp *http.Response, err error) {
	resp, err = c.httpClient.Do(r)
	if err != nil {
		return resp, err
	}

	if resp.Request != nil && resp.Request.URL != nil {
		url := *resp.Request.URL
		url.RawQuery = ""
		c.location = url.String()
	}

	return resp, err
}

// internal structure to manage a specific multipart upload to S3.
type multiuploader struct {
	*uploader
	wg       sync.WaitGroup
	m        sync.Mutex
	err      error
	uploadID string
	parts    completedParts
}

// keeps track of a single chunk of data being sent to S3.
type chunk struct {
	buf     io.ReadSeeker
	num     int32
	cleanup func()
}

// completedParts is a wrapper to make parts sortable by their part number,
// since S3 required this list to be sent in sorted order.
type completedParts []types.CompletedPart

func (a completedParts) Len() int      { return len(a) }
func (a completedParts) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a completedParts) Less(i, j int) bool {
	return aws.ToInt32(a[i].PartNumber) < aws.ToInt32(a[j].PartNumber)
}

// upload will perform a multipart upload using the firstBuf buffer containing
// the first chunk of data.
func (u *multiuploader) upload(firstBuf io.ReadSeeker, cleanup func()) (*UploadOutput, error) {
	u.initChecksumAlgorithm()

	var params s3.CreateMultipartUploadInput
	awsutil.Copy(&params, u.in)

	// Create the multipart
	var locationRecorder recordLocationClient
	resp, err := u.cfg.S3.CreateMultipartUpload(u.ctx, &params,
		append(u.cfg.ClientOptions, locationRecorder.WrapClient())...)
	if err != nil {
		cleanup()
		return nil, err
	}
	u.uploadID = *resp.UploadId

	// Create the workers
	ch := make(chan chunk, u.cfg.Concurrency)
	for i := 0; i < u.cfg.Concurrency; i++ {
		u.wg.Add(1)
		go u.readChunk(ch)
	}

	// Send part 1 to the workers
	var num int32 = 1
	ch <- chunk{buf: firstBuf, num: num, cleanup: cleanup}

	// Read and queue the rest of the parts
	for u.geterr() == nil && err == nil {
		var (
			reader       io.ReadSeeker
			nextChunkLen int
			ok           bool
		)

		reader, nextChunkLen, cleanup, err = u.nextReader()
		ok, err = u.shouldContinue(num, nextChunkLen, err)
		if !ok {
			cleanup()
			if err != nil {
				u.seterr(err)
			}
			break
		}

		num++

		ch <- chunk{buf: reader, num: num, cleanup: cleanup}
	}

	// Close the channel, wait for workers, and complete upload
	close(ch)
	u.wg.Wait()
	completeOut := u.complete()

	if err := u.geterr(); err != nil {
		return nil, &multiUploadError{
			err:      err,
			uploadID: u.uploadID,
		}
	}

	return &UploadOutput{
		Location:       locationRecorder.location,
		UploadID:       u.uploadID,
		CompletedParts: u.parts,

		BucketKeyEnabled:     aws.ToBool(completeOut.BucketKeyEnabled),
		ChecksumCRC32:        completeOut.ChecksumCRC32,
		ChecksumCRC32C:       completeOut.ChecksumCRC32C,
		ChecksumCRC64NVME:    completeOut.ChecksumCRC64NVME,
		ChecksumSHA1:         completeOut.ChecksumSHA1,
		ChecksumSHA256:       completeOut.ChecksumSHA256,
		ETag:                 completeOut.ETag,
		Expiration:           completeOut.Expiration,
		Key:                  completeOut.Key,
		RequestCharged:       completeOut.RequestCharged,
		SSEKMSKeyId:          completeOut.SSEKMSKeyId,
		ServerSideEncryption: completeOut.ServerSideEncryption,
		VersionID:            completeOut.VersionId,
	}, nil
}

func (u *multiuploader) shouldContinue(part int32, nextChunkLen int, err error) (bool, error) {
	if err != nil && err != io.EOF {
		return false, fmt.Errorf("read multipart upload data failed, %w", err)
	}

	if nextChunkLen == 0 {
		// No need to upload empty part, if file was empty to start
		// with empty single part would of been created and never
		// started multipart upload.
		return false, nil
	}

	part++
	// This upload exceeded maximum number of supported parts, error now.
	if part > u.cfg.MaxUploadParts || part > MaxUploadParts {
		var msg string
		if part > u.cfg.MaxUploadParts {
			msg = fmt.Sprintf("exceeded total allowed configured MaxUploadParts (%d). Adjust PartSize to fit in this limit",
				u.cfg.MaxUploadParts)
		} else {
			msg = fmt.Sprintf("exceeded total allowed S3 limit MaxUploadParts (%d). Adjust PartSize to fit in this limit",
				MaxUploadParts)
		}
		return false, errors.New(msg)
	}

	return true, err
}

// readChunk runs in worker goroutines to pull chunks off of the ch channel
// and send() them as UploadPart requests.
func (u *multiuploader) readChunk(ch chan chunk) {
	defer u.wg.Done()
	for {
		data, ok := <-ch

		if !ok {
			break
		}

		if u.geterr() == nil {
			if err := u.send(data); err != nil {
				u.seterr(err)
			}
		}

		data.cleanup()
	}
}

// send performs an UploadPart request and keeps track of the completed
// part information.
func (u *multiuploader) send(c chunk) error {
	params := &s3.UploadPartInput{
		Bucket:               u.in.Bucket,
		Key:                  u.in.Key,
		Body:                 c.buf,
		SSECustomerAlgorithm: u.in.SSECustomerAlgorithm,
		SSECustomerKey:       u.in.SSECustomerKey,
		SSECustomerKeyMD5:    u.in.SSECustomerKeyMD5,
		ExpectedBucketOwner:  u.in.ExpectedBucketOwner,
		RequestPayer:         u.in.RequestPayer,

		ChecksumAlgorithm: u.in.ChecksumAlgorithm,
		// Invalid to set any of the individual ChecksumXXX members from
		// PutObject as they are never valid for individual parts of a
		// multipart upload.

		PartNumber: aws.Int32(c.num),
		UploadId:   &u.uploadID,
	}
	// TODO should do copy then clear?

	resp, err := u.cfg.S3.UploadPart(u.ctx, params, u.cfg.ClientOptions...)
	if err != nil {
		return err
	}

	var completed types.CompletedPart
	awsutil.Copy(&completed, resp)
	completed.PartNumber = aws.Int32(c.num)

	u.m.Lock()
	u.parts = append(u.parts, completed)
	u.m.Unlock()

	return nil
}

func (u *multiuploader) initChecksumAlgorithm() {
	if u.in.ChecksumAlgorithm != "" {
		return
	}

	switch {
	case u.in.ChecksumCRC32 != nil:
		u.in.ChecksumAlgorithm = types.ChecksumAlgorithmCrc32
	case u.in.ChecksumCRC32C != nil:
		u.in.ChecksumAlgorithm = types.ChecksumAlgorithmCrc32c
	case u.in.ChecksumCRC64NVME != nil:
		u.in.ChecksumAlgorithm = types.ChecksumAlgorithmCrc64nvme
	case u.in.ChecksumSHA1 != nil:
		u.in.ChecksumAlgorithm = types.ChecksumAlgorithmSha1
	case u.in.ChecksumSHA256 != nil:
		u.in.ChecksumAlgorithm = types.ChecksumAlgorithmSha256
	default:
		u.in.ChecksumAlgorithm = types.ChecksumAlgorithmCrc32
	}
}

// geterr is a thread-safe getter for the error object
func (u *multiuploader) geterr() error {
	u.m.Lock()
	defer u.m.Unlock()

	return u.err
}

// seterr is a thread-safe setter for the error object
func (u *multiuploader) seterr(e error) {
	u.m.Lock()
	defer u.m.Unlock()

	u.err = e
}

// fail will abort the multipart unless LeavePartsOnError is set to true.
func (u *multiuploader) fail() {
	if u.cfg.LeavePartsOnError {
		return
	}

	params := &s3.AbortMultipartUploadInput{
		Bucket:   u.in.Bucket,
		Key:      u.in.Key,
		UploadId: &u.uploadID,
	}
	_, err := u.cfg.S3.AbortMultipartUpload(u.ctx, params, u.cfg.ClientOptions...)
	if err != nil {
		// TODO: Add logging
		//logMessage(u.cfg.S3, aws.LogDebug, fmt.Sprintf("failed to abort multipart upload, %v", err))
		_ = err
	}
}

// complete successfully completes a multipart upload and returns the response.
func (u *multiuploader) complete() *s3.CompleteMultipartUploadOutput {
	if u.geterr() != nil {
		u.fail()
		return nil
	}

	// Parts must be sorted in PartNumber order.
	sort.Sort(u.parts)

	var params s3.CompleteMultipartUploadInput
	awsutil.Copy(&params, u.in)
	params.UploadId = &u.uploadID
	params.MultipartUpload = &types.CompletedMultipartUpload{Parts: u.parts}

	resp, err := u.cfg.S3.CompleteMultipartUpload(u.ctx, &params, u.cfg.ClientOptions...)
	if err != nil {
		u.seterr(err)
		u.fail()
	}

	return resp
}

type readerAtSeeker interface {
	io.ReaderAt
	io.ReadSeeker
}

// setS3ExpressDefaultChecksum defaults to CRC32 for S3Express buckets,
// which is required when uploading to those through transfer manager.
type setS3ExpressDefaultChecksum struct{}

func (*setS3ExpressDefaultChecksum) ID() string {
	return "setS3ExpressDefaultChecksum"
}

func (*setS3ExpressDefaultChecksum) HandleFinalize(
	ctx context.Context, in smithymiddleware.FinalizeInput, next smithymiddleware.FinalizeHandler,
) (
	out smithymiddleware.FinalizeOutput, metadata smithymiddleware.Metadata, err error,
) {
	const checksumHeader = "x-amz-checksum-algorithm"

	if internalcontext.GetS3Backend(ctx) != internalcontext.S3BackendS3Express {
		return next.HandleFinalize(ctx, in)
	}

	// If this is CreateMultipartUpload we need to ensure the checksum
	// algorithm header is present. Otherwise everything is driven off the
	// context setting and we can let it flow from there.
	if middleware.GetOperationName(ctx) == "CreateMultipartUpload" {
		r, ok := in.Request.(*smithyhttp.Request)
		if !ok {
			return out, metadata, fmt.Errorf("unknown transport type %T", in.Request)
		}

		if internalcontext.GetChecksumInputAlgorithm(ctx) == "" {
			r.Header.Set(checksumHeader, "CRC32")
		}
		return next.HandleFinalize(ctx, in)
	} else if internalcontext.GetChecksumInputAlgorithm(ctx) == "" {
		ctx = internalcontext.SetChecksumInputAlgorithm(ctx, string(types.ChecksumAlgorithmCrc32))
	}

	return next.HandleFinalize(ctx, in)
}

func addFeatureUserAgent(stack *smithymiddleware.Stack) error {
	ua, err := getOrAddRequestUserAgent(stack)
	if err != nil {
		return err
	}

	ua.AddUserAgentFeature(middleware.UserAgentFeatureS3Transfer)
	return nil
}

func getOrAddRequestUserAgent(stack *smithymiddleware.Stack) (*middleware.RequestUserAgent, error) {
	id := (*middleware.RequestUserAgent)(nil).ID()
	mw, ok := stack.Build.Get(id)
	if !ok {
		mw = middleware.NewRequestUserAgent()
		if err := stack.Build.Add(mw, smithymiddleware.After); err != nil {
			return nil, err
		}
	}

	ua, ok := mw.(*middleware.RequestUserAgent)
	if !ok {
		return nil, fmt.Errorf("%T for %s middleware did not match expected type", mw, id)
	}

	return ua, nil
}
