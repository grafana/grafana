package s3

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/request"
	"github.com/aws/aws-sdk-go/internal/sdkio"
)

func copyMultipartStatusOKUnmarshalError(r *request.Request) {
	b, err := ioutil.ReadAll(r.HTTPResponse.Body)
	r.HTTPResponse.Body.Close()
	if err != nil {
		r.Error = awserr.NewRequestFailure(
			awserr.New(request.ErrCodeSerialization, "unable to read response body", err),
			r.HTTPResponse.StatusCode,
			r.RequestID,
		)
		// Note, some middleware later in the stack like restxml.Unmarshal expect a valid, non-closed Body
		// even in case of an error, so we replace it with an empty Reader.
		r.HTTPResponse.Body = ioutil.NopCloser(bytes.NewBuffer(nil))
		return
	}

	body := bytes.NewReader(b)
	r.HTTPResponse.Body = ioutil.NopCloser(body)
	defer body.Seek(0, sdkio.SeekStart)

	unmarshalError(r)
	if err, ok := r.Error.(awserr.Error); ok && err != nil {
		if err.Code() == request.ErrCodeSerialization &&
			err.OrigErr() != io.EOF {
			r.Error = nil
			return
		}
		// if empty payload
		if err.OrigErr() == io.EOF {
			r.HTTPResponse.StatusCode = http.StatusInternalServerError
		} else {
			r.HTTPResponse.StatusCode = http.StatusServiceUnavailable
		}
	}
}
