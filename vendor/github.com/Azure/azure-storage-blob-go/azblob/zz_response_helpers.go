package azblob

import (
	"context"
	"io"
	"net/http"
	"time"
)

// BlobHTTPHeaders contains read/writeable blob properties.
type BlobHTTPHeaders struct {
	ContentType        string
	ContentMD5         []byte
	ContentEncoding    string
	ContentLanguage    string
	ContentDisposition string
	CacheControl       string
}

// NewHTTPHeaders returns the user-modifiable properties for this blob.
func (bgpr BlobGetPropertiesResponse) NewHTTPHeaders() BlobHTTPHeaders {
	return BlobHTTPHeaders{
		ContentType:        bgpr.ContentType(),
		ContentEncoding:    bgpr.ContentEncoding(),
		ContentLanguage:    bgpr.ContentLanguage(),
		ContentDisposition: bgpr.ContentDisposition(),
		CacheControl:       bgpr.CacheControl(),
		ContentMD5:         bgpr.ContentMD5(),
	}
}

// /////////////////////////////////////////////////////////////////////////////

// NewHTTPHeaders returns the user-modifiable properties for this blob.
func (dr downloadResponse) NewHTTPHeaders() BlobHTTPHeaders {
	return BlobHTTPHeaders{
		ContentType:        dr.ContentType(),
		ContentEncoding:    dr.ContentEncoding(),
		ContentLanguage:    dr.ContentLanguage(),
		ContentDisposition: dr.ContentDisposition(),
		CacheControl:       dr.CacheControl(),
		ContentMD5:         dr.ContentMD5(),
	}
}

// /////////////////////////////////////////////////////////////////////////////

// DownloadResponse wraps AutoRest generated downloadResponse and helps to provide info for retry.
type DownloadResponse struct {
	r       *downloadResponse
	ctx     context.Context
	b       BlobURL
	getInfo HTTPGetterInfo
}

// Body constructs new RetryReader stream for reading data. If a connection failes
// while reading, it will make additional requests to reestablish a connection and
// continue reading. Specifying a RetryReaderOption's with MaxRetryRequests set to 0
// (the default), returns the original response body and no retries will be performed.
func (r *DownloadResponse) Body(o RetryReaderOptions) io.ReadCloser {
	if o.MaxRetryRequests == 0 { // No additional retries
		return r.Response().Body
	}
	return NewRetryReader(r.ctx, r.Response(), r.getInfo, o,
		func(ctx context.Context, getInfo HTTPGetterInfo) (*http.Response, error) {
			resp, err := r.b.Download(ctx, getInfo.Offset, getInfo.Count, BlobAccessConditions{
				ModifiedAccessConditions: ModifiedAccessConditions{IfMatch: getInfo.ETag},
			}, false, o.ClientProvidedKeyOptions)
			if err != nil {
				return nil, err
			}
			return resp.Response(), err
		},
	)
}

// Response returns the raw HTTP response object.
func (r DownloadResponse) Response() *http.Response {
	return r.r.Response()
}

// NewHTTPHeaders returns the user-modifiable properties for this blob.
func (r DownloadResponse) NewHTTPHeaders() BlobHTTPHeaders {
	return r.r.NewHTTPHeaders()
}

// BlobContentMD5 returns the value for header x-ms-blob-content-md5.
func (r DownloadResponse) BlobContentMD5() []byte {
	return r.r.BlobContentMD5()
}

// ContentMD5 returns the value for header Content-MD5.
func (r DownloadResponse) ContentMD5() []byte {
	return r.r.ContentMD5()
}

// StatusCode returns the HTTP status code of the response, e.g. 200.
func (r DownloadResponse) StatusCode() int {
	return r.r.StatusCode()
}

// Status returns the HTTP status message of the response, e.g. "200 OK".
func (r DownloadResponse) Status() string {
	return r.r.Status()
}

// AcceptRanges returns the value for header Accept-Ranges.
func (r DownloadResponse) AcceptRanges() string {
	return r.r.AcceptRanges()
}

// BlobCommittedBlockCount returns the value for header x-ms-blob-committed-block-count.
func (r DownloadResponse) BlobCommittedBlockCount() int32 {
	return r.r.BlobCommittedBlockCount()
}

// BlobSequenceNumber returns the value for header x-ms-blob-sequence-number.
func (r DownloadResponse) BlobSequenceNumber() int64 {
	return r.r.BlobSequenceNumber()
}

// BlobType returns the value for header x-ms-blob-type.
func (r DownloadResponse) BlobType() BlobType {
	return r.r.BlobType()
}

// CacheControl returns the value for header Cache-Control.
func (r DownloadResponse) CacheControl() string {
	return r.r.CacheControl()
}

// ContentDisposition returns the value for header Content-Disposition.
func (r DownloadResponse) ContentDisposition() string {
	return r.r.ContentDisposition()
}

// ContentEncoding returns the value for header Content-Encoding.
func (r DownloadResponse) ContentEncoding() string {
	return r.r.ContentEncoding()
}

// ContentLanguage returns the value for header Content-Language.
func (r DownloadResponse) ContentLanguage() string {
	return r.r.ContentLanguage()
}

// ContentLength returns the value for header Content-Length.
func (r DownloadResponse) ContentLength() int64 {
	return r.r.ContentLength()
}

// ContentRange returns the value for header Content-Range.
func (r DownloadResponse) ContentRange() string {
	return r.r.ContentRange()
}

// ContentType returns the value for header Content-Type.
func (r DownloadResponse) ContentType() string {
	return r.r.ContentType()
}

// CopyCompletionTime returns the value for header x-ms-copy-completion-time.
func (r DownloadResponse) CopyCompletionTime() time.Time {
	return r.r.CopyCompletionTime()
}

// CopyID returns the value for header x-ms-copy-id.
func (r DownloadResponse) CopyID() string {
	return r.r.CopyID()
}

// CopyProgress returns the value for header x-ms-copy-progress.
func (r DownloadResponse) CopyProgress() string {
	return r.r.CopyProgress()
}

// CopySource returns the value for header x-ms-copy-source.
func (r DownloadResponse) CopySource() string {
	return r.r.CopySource()
}

// CopyStatus returns the value for header x-ms-copy-status.
func (r DownloadResponse) CopyStatus() CopyStatusType {
	return r.r.CopyStatus()
}

// CopyStatusDescription returns the value for header x-ms-copy-status-description.
func (r DownloadResponse) CopyStatusDescription() string {
	return r.r.CopyStatusDescription()
}

// Date returns the value for header Date.
func (r DownloadResponse) Date() time.Time {
	return r.r.Date()
}

// ETag returns the value for header ETag.
func (r DownloadResponse) ETag() ETag {
	return ETag(r.r.ETag())
}

// IsServerEncrypted returns the value for header x-ms-server-encrypted.
func (r DownloadResponse) IsServerEncrypted() string {
	return r.r.IsServerEncrypted()
}

// LastModified returns the value for header Last-Modified.
func (r DownloadResponse) LastModified() time.Time {
	return r.r.LastModified()
}

// LeaseDuration returns the value for header x-ms-lease-duration.
func (r DownloadResponse) LeaseDuration() LeaseDurationType {
	return r.r.LeaseDuration()
}

// LeaseState returns the value for header x-ms-lease-state.
func (r DownloadResponse) LeaseState() LeaseStateType {
	return r.r.LeaseState()
}

// LeaseStatus returns the value for header x-ms-lease-status.
func (r DownloadResponse) LeaseStatus() LeaseStatusType {
	return r.r.LeaseStatus()
}

// RequestID returns the value for header x-ms-request-id.
func (r DownloadResponse) RequestID() string {
	return r.r.RequestID()
}

// Version returns the value for header x-ms-version.
func (r DownloadResponse) Version() string {
	return r.r.Version()
}

// NewMetadata returns user-defined key/value pairs.
func (r DownloadResponse) NewMetadata() Metadata {
	return r.r.NewMetadata()
}
