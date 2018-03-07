// Package s3util provides streaming transfers to and from Amazon S3.
//
// To use it, open or create an S3 object, read or write data,
// and close the object.
//
// You must assign valid credentials to DefaultConfig.Keys before using
// DefaultConfig. Be sure to close an io.WriteCloser returned by this package,
// to flush buffers and complete the multipart upload process.
package s3util

// TODO(kr): parse error responses; return structured data

import (
	"github.com/kr/s3"
	"net/http"
)

var DefaultConfig = &Config{
	Service: s3.DefaultService,
	Keys:    new(s3.Keys),
}

type Config struct {
	*s3.Service
	*s3.Keys
	*http.Client // if nil, uses http.DefaultClient
}
