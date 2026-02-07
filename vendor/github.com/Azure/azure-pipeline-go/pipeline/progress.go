package pipeline

import "io"

// ********** The following is common between the request body AND the response body.

// ProgressReceiver defines the signature of a callback function invoked as progress is reported.
type ProgressReceiver func(bytesTransferred int64)

// ********** The following are specific to the request body (a ReadSeekCloser)

// This struct is used when sending a body to the network
type requestBodyProgress struct {
	requestBody io.ReadSeeker // Seeking is required to support retries
	pr          ProgressReceiver
}

// NewRequestBodyProgress adds progress reporting to an HTTP request's body stream.
func NewRequestBodyProgress(requestBody io.ReadSeeker, pr ProgressReceiver) io.ReadSeeker {
	if pr == nil {
		panic("pr must not be nil")
	}
	return &requestBodyProgress{requestBody: requestBody, pr: pr}
}

// Read reads a block of data from an inner stream and reports progress
func (rbp *requestBodyProgress) Read(p []byte) (n int, err error) {
	n, err = rbp.requestBody.Read(p)
	if err != nil {
		return
	}
	// Invokes the user's callback method to report progress
	position, err := rbp.requestBody.Seek(0, io.SeekCurrent)
	if err != nil {
		panic(err)
	}
	rbp.pr(position)
	return
}

func (rbp *requestBodyProgress) Seek(offset int64, whence int) (offsetFromStart int64, err error) {
	return rbp.requestBody.Seek(offset, whence)
}

// requestBodyProgress supports Close but the underlying stream may not; if it does, Close will close it.
func (rbp *requestBodyProgress) Close() error {
	if c, ok := rbp.requestBody.(io.Closer); ok {
		return c.Close()
	}
	return nil
}

// ********** The following are specific to the response body (a ReadCloser)

// This struct is used when sending a body to the network
type responseBodyProgress struct {
	responseBody io.ReadCloser
	pr           ProgressReceiver
	offset       int64
}

// NewResponseBodyProgress adds progress reporting to an HTTP response's body stream.
func NewResponseBodyProgress(responseBody io.ReadCloser, pr ProgressReceiver) io.ReadCloser {
	if pr == nil {
		panic("pr must not be nil")
	}
	return &responseBodyProgress{responseBody: responseBody, pr: pr, offset: 0}
}

// Read reads a block of data from an inner stream and reports progress
func (rbp *responseBodyProgress) Read(p []byte) (n int, err error) {
	n, err = rbp.responseBody.Read(p)
	rbp.offset += int64(n)

	// Invokes the user's callback method to report progress
	rbp.pr(rbp.offset)
	return
}

func (rbp *responseBodyProgress) Close() error {
	return rbp.responseBody.Close()
}
